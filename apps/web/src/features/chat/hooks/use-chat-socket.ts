import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getCurrentAccessToken } from '@/api/client';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
// The gateway lives on the same origin as the REST API, under the `/chat`
// socket.io namespace — not under the `/api/v1` HTTP prefix (see
// apps/api/src/main.ts's `RedisIoAdapter` / `ChatGateway`'s
// `@WebSocketGateway({ namespace: '/chat' })`).
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export type ChatConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ChatErrorEventPayload {
  code: 'UNAUTHENTICATED' | 'INVALID_REQUEST' | 'FORBIDDEN';
  channelId?: string;
}

interface UseChatSocketResult {
  socket: Socket | null;
  status: ChatConnectionStatus;
  /** True once the server has confirmed `chat.subscribe` for the *current*
   * `channelId` — flips back to false immediately on channel switch or
   * disconnect, so callers can treat a true→true-again transition (a fresh
   * subscribe after a reconnect) as "safe to refetch the latest page now". */
  subscribed: boolean;
  subscribeError: ChatErrorEventPayload | null;
}

/** One socket per mounted chat workspace (kept alive across channel
 * switches within the same Fellowship — only re-created if the active
 * organization changes). Every write (message/reaction/channel mutation)
 * goes through the REST endpoints in `chat-api.ts`; this hook only ever
 * subscribes to receive the resulting broadcasts, matching the gateway's
 * own subscribe-only design (docs/adr/0014-fellowship-chat.md Decision 3).
 * Reconnection re-subscribes automatically, but never replays missed
 * messages itself (Redis is not the source of truth) — callers should treat
 * a fresh `subscribed` as a cue to refetch from Postgres via REST. */
export function useChatSocket(
  organizationId: string | undefined,
  channelId: string | undefined,
): UseChatSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ChatConnectionStatus>('connecting');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<ChatErrorEventPayload | null>(null);
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  useEffect(() => {
    const token = getCurrentAccessToken();
    if (!token || !organizationId) return;

    const nextSocket = io(`${SOCKET_ORIGIN}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    setSocket(nextSocket);
    setStatus('connecting');

    nextSocket.on('connect', () => setStatus('connected'));
    nextSocket.on('disconnect', () => {
      setStatus('disconnected');
      setSubscribed(false);
    });
    nextSocket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    nextSocket.on('chat.access.revoked', (payload: { channelId: string }) => {
      if (payload.channelId === channelIdRef.current) setSubscribed(false);
    });

    return () => {
      nextSocket.close();
    };
  }, [organizationId]);

  useEffect(() => {
    if (!socket || !organizationId || !channelId) return;
    setSubscribed(false);
    setSubscribeError(null);

    function subscribe() {
      socket?.emit('chat.subscribe', { channelId, organizationId });
    }
    function onSubscribed(payload: { channelId: string }) {
      if (payload.channelId !== channelId) return;
      setSubscribed(true);
      setSubscribeError(null);
    }
    function onError(payload: ChatErrorEventPayload) {
      if (payload.channelId && payload.channelId !== channelId) return;
      setSubscribeError(payload);
    }

    socket.on('chat.subscribed', onSubscribed);
    socket.on('chat.error', onError);
    socket.on('connect', subscribe);
    if (socket.connected) subscribe();

    return () => {
      socket.emit('chat.unsubscribe', { channelId });
      socket.off('chat.subscribed', onSubscribed);
      socket.off('chat.error', onError);
      socket.off('connect', subscribe);
    };
  }, [socket, organizationId, channelId]);

  return { socket, status, subscribed, subscribeError };
}
