import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenService } from '../../identity/services/access-token.service';
import { ChatChannelsService } from '../services/chat-channels.service';
import { RedisEventsService } from '../services/redis-events.service';

const REVALIDATE_INTERVAL_MS = 30_000;

interface SocketData {
  userId?: string;
  /** channelId -> organizationId, for every room this socket has actually
   * joined — the set the periodic revalidation sweep re-checks. */
  subscriptions: Map<string, string>;
}

type ChatSocket = Socket & { data: SocketData };

/** Real-time delivery only — every write (message create/update/delete,
 * reactions) happens over the same authenticated REST endpoints
 * `ChatMessagesController` already exposes, not a second WS-side write
 * path. That's a deliberate simplification: it means there is exactly one
 * authorization-checked code path for every mutation regardless of which
 * client surface triggered it, and it trivially satisfies "a client must
 * never be able to send directly to a Fellowship it isn't authorized for
 * over the WebSocket" — there is no WS handler that could do that at all.
 * See docs/adr/0014-fellowship-chat.md Decision 3.
 *
 * Every one of "1. authenticated user, 2. requested Fellowship,
 * 3. requested Channel, 4. current authorization" (Phase 6) is checked on
 * every `chat.subscribe` call via the exact same `ChatChannelsService.get()`
 * the REST `GET /chat/channels/:id` endpoint uses — one source of truth,
 * not a parallel WS-side re-implementation. Because a socket can stay
 * connected and subscribed far longer than a single request, a revoked
 * grant (removed from a cohort, suspended, organization switch) would
 * otherwise leave a stale, still-listening subscription — `revalidateAll()`
 * re-runs that same check for every live subscription every 30s and force-
 * unsubscribes (with a `chat.access.revoked` event) anything no longer
 * authorized, per Phase 7's "do not leave stale authorization windows
 * unnecessarily long." */
// `cors.origin` reads `process.env.WEB_ORIGIN` directly rather than
// `AppConfigService` — `@WebSocketGateway`'s options are evaluated once at
// class-definition time, before Nest's DI container exists, the same
// constraint every NestJS WS gateway with configurable CORS runs into.
// `main.ts`'s own `app.enableCors()` call reads the same env var through
// the config service for the REST side of this same origin restriction.
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.WEB_ORIGIN, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private revalidateTimer?: NodeJS.Timeout;

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly channelsService: ChatChannelsService,
    private readonly events: RedisEventsService,
  ) {}

  afterInit(): void {
    this.events.onEvent((event) => {
      this.server.to(roomFor(event.channelId)).emit(event.event, event.payload);
    });

    this.revalidateTimer = setInterval(() => {
      void this.revalidateAll();
    }, REVALIDATE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.revalidateTimer) clearInterval(this.revalidateTimer);
  }

  handleConnection(client: ChatSocket): void {
    client.data.subscriptions = new Map();
    const token = extractToken(client);
    if (!token) {
      client.emit('chat.error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.accessTokenService.verify(token);
      client.data.userId = payload.sub;
    } catch {
      client.emit('chat.error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Nothing to persist — presence is deliberately not tracked (Phase 6:
    // "do not build a full presence service"); socket.io's own room
    // membership is cleaned up automatically on disconnect.
  }

  @SubscribeMessage('chat.subscribe')
  async onSubscribe(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { channelId?: string; organizationId?: string },
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId) return this.reject(client, 'UNAUTHENTICATED');
    if (!body?.channelId || !body?.organizationId) {
      return this.reject(client, 'INVALID_REQUEST', body?.channelId);
    }

    try {
      // Same authorization path `GET /chat/channels/:id` uses — see the
      // class doc comment. Throws AppException.notFound for every denial
      // reason (wrong tenant, no fellowship access, private channel not a
      // member) without distinguishing which, exactly like the REST route.
      await this.channelsService.get(
        { organizationId: body.organizationId },
        userId,
        body.channelId,
      );
    } catch {
      return this.reject(client, 'FORBIDDEN', body.channelId);
    }

    await client.join(roomFor(body.channelId));
    client.data.subscriptions.set(body.channelId, body.organizationId);
    client.emit('chat.subscribed', { channelId: body.channelId });
  }

  @SubscribeMessage('chat.unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { channelId?: string },
  ): void {
    if (!body?.channelId) return;
    void client.leave(roomFor(body.channelId));
    client.data.subscriptions.delete(body.channelId);
  }

  @SubscribeMessage('chat.typing.start')
  onTypingStart(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { channelId?: string },
  ): void {
    this.relayTyping(client, body?.channelId, 'chat.typing.started');
  }

  @SubscribeMessage('chat.typing.stop')
  onTypingStop(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { channelId?: string },
  ): void {
    this.relayTyping(client, body?.channelId, 'chat.typing.stopped');
  }

  /** Typing indicators are ephemeral and never persisted (Phase 6) — a
   * direct room relay, deliberately bypassing Redis/PostgreSQL entirely.
   * Only relayed to a room this exact socket has already been authorized
   * into via `chat.subscribe`, so a client can't fabricate typing noise for
   * a channel it was never granted access to. */
  private relayTyping(client: ChatSocket, channelId: string | undefined, event: string): void {
    if (!channelId || !client.data.subscriptions.has(channelId)) return;
    client.to(roomFor(channelId)).emit(event, { channelId, userId: client.data.userId });
  }

  private reject(client: ChatSocket, code: string, channelId?: string): void {
    client.emit('chat.error', { code, channelId });
  }

  /** Phase 7: "do not rely exclusively on authorization performed when the
   * WebSocket connection was first established... must be evaluated
   * against current state." Sweeps every live subscription on every
   * *locally* connected socket and re-runs the exact same authorization
   * check `chat.subscribe` used, every 30s. Deliberately local-only
   * (`this.server.sockets`, not a cross-instance `fetchSockets()` call): a
   * given socket connection is always owned by exactly one instance, so
   * that instance revalidating its own sockets is already complete — no
   * cross-instance coordination is needed for this sweep, and `socket.data`
   * (a `Map`) wouldn't survive the Redis adapter's serialization if fetched
   * remotely anyway. */
  private async revalidateAll(): Promise<void> {
    for (const socket of this.server.sockets.values()) {
      const data = (socket as ChatSocket).data;
      if (!data.userId || data.subscriptions.size === 0) continue;
      for (const [channelId, organizationId] of data.subscriptions) {
        try {
          await this.channelsService.get({ organizationId }, data.userId, channelId);
        } catch {
          void socket.leave(roomFor(channelId));
          data.subscriptions.delete(channelId);
          socket.emit('chat.access.revoked', { channelId });
        }
      }
    }
  }
}

function roomFor(channelId: string): string {
  return `channel:${channelId}`;
}

function extractToken(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;
  const header = client.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const queryToken = client.handshake.query?.token;
  return typeof queryToken === 'string' ? queryToken : undefined;
}
