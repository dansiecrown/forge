import type { AccessTokenService } from '../../identity/services/access-token.service';
import type { ChatChannelsService } from '../services/chat-channels.service';
import type { RedisEventsService } from '../services/redis-events.service';
import { ChatGateway } from './chat.gateway';

/** Unit-level coverage for the in-memory flood protection added in
 * Milestone 8 (production hardening) — deliberately does not stand up a
 * real socket.io server or Redis, unlike
 * `chat-websocket-isolation.integration.spec.ts`, since this only needs to
 * exercise the gateway's own counters against fake socket-shaped objects. */
describe('ChatGateway — connection and event flood protection', () => {
  function fakeAccessTokenService(): AccessTokenService {
    return { verify: jest.fn(() => ({ sub: 'user-1' })) } as unknown as AccessTokenService;
  }

  function fakeChannelsService(): ChatChannelsService {
    return { get: jest.fn(async () => ({ id: 'channel-1' })) } as unknown as ChatChannelsService;
  }

  function fakeEventsService(): RedisEventsService {
    return { onEvent: jest.fn() } as unknown as RedisEventsService;
  }

  function fakeSocket(overrides: { id?: string; ip?: string } = {}) {
    return {
      id: overrides.id ?? 'socket-1',
      data: {} as { userId?: string; subscriptions: Map<string, string> },
      handshake: {
        address: overrides.ip ?? '10.0.0.1',
        auth: { token: 'valid-token' },
        headers: {},
        query: {},
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(async () => undefined),
      leave: jest.fn(async () => undefined),
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
  }

  function buildGateway() {
    return new ChatGateway(fakeAccessTokenService(), fakeChannelsService(), fakeEventsService());
  }

  it('accepts connections from one IP up to the configured limit', () => {
    const gateway = buildGateway();
    for (let i = 0; i < 30; i++) {
      const socket = fakeSocket({ id: `socket-${i}`, ip: '10.0.0.1' });
      gateway.handleConnection(socket as never);
      expect(socket.disconnect).not.toHaveBeenCalled();
    }
  });

  it('rejects the 31st connection from the same IP within the window', () => {
    const gateway = buildGateway();
    for (let i = 0; i < 30; i++) {
      gateway.handleConnection(fakeSocket({ id: `socket-${i}`, ip: '10.0.0.2' }) as never);
    }
    const overLimit = fakeSocket({ id: 'socket-30', ip: '10.0.0.2' });
    gateway.handleConnection(overLimit as never);
    expect(overLimit.emit).toHaveBeenCalledWith('chat.error', { code: 'RATE_LIMITED' });
    expect(overLimit.disconnect).toHaveBeenCalledWith(true);
  });

  it('never counts one IP against a different IP’s connection limit', () => {
    const gateway = buildGateway();
    for (let i = 0; i < 30; i++) {
      gateway.handleConnection(fakeSocket({ id: `socket-a-${i}`, ip: '10.0.0.3' }) as never);
    }
    const otherIp = fakeSocket({ id: 'socket-b', ip: '10.0.0.4' });
    gateway.handleConnection(otherIp as never);
    expect(otherIp.disconnect).not.toHaveBeenCalled();
  });

  it('rejects a socket that sends more than the per-socket event limit', () => {
    const gateway = buildGateway();
    const socket = fakeSocket({ id: 'socket-flood' });
    gateway.handleConnection(socket as never);
    socket.data.userId = 'user-1';

    for (let i = 0; i < 60; i++) {
      gateway.onTypingStart(socket as never, { channelId: undefined });
    }
    expect(socket.emit).not.toHaveBeenCalledWith('chat.error', { code: 'RATE_LIMITED' });

    gateway.onTypingStart(socket as never, { channelId: undefined });
    expect(socket.emit).toHaveBeenCalledWith('chat.error', {
      code: 'RATE_LIMITED',
      channelId: undefined,
    });
  });

  it('clears a socket’s event counter on disconnect', () => {
    const gateway = buildGateway();
    const socket = fakeSocket({ id: 'socket-reuse' });
    gateway.handleConnection(socket as never);
    socket.data.userId = 'user-1';

    for (let i = 0; i < 60; i++) {
      gateway.onTypingStart(socket as never, {});
    }
    gateway.handleDisconnect(socket as never);

    // A fresh socket reusing the same id after disconnect starts with a
    // clean counter, not still-exhausted from the previous connection.
    socket.emit.mockClear();
    gateway.onTypingStart(socket as never, {});
    expect(socket.emit).not.toHaveBeenCalledWith(
      'chat.error',
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );
  });
});
