import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

/** Redis's first real wiring in this codebase — see
 * docs/adr/0014-fellowship-chat.md Decision 2. Scoped strictly to what the
 * chat gateway needs: cross-instance pub/sub for socket.io's Redis adapter.
 * Not the source of truth for anything — PostgreSQL persists every message;
 * Redis only carries the "someone should re-broadcast this" event.
 *
 * Exposes two separate connections (`pubClient`/`subClient`) because a
 * connection actively subscribed to a channel cannot issue other Redis
 * commands — the exact shape socket.io's own Redis adapter expects.
 *
 * Connection failures are logged, never thrown — per the "Redis failure
 * must not silently lose persisted messages" requirement, a down Redis
 * degrades this single API instance to no cross-instance fan-out (still
 * fully correct for a single-instance deployment, which is this project's
 * actual topology today) rather than taking the app down or blocking writes. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly pubClient: Redis;
  readonly subClient: Redis;

  constructor(config: AppConfigService) {
    const url = config.redis.url;
    this.pubClient = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.subClient = this.pubClient.duplicate();

    for (const [label, client] of [
      ['pub', this.pubClient],
      ['sub', this.subClient],
    ] as const) {
      client.on('error', (error) => {
        this.logger.warn(`Redis ${label} client error: ${error.message}`);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.pubClient.quit(), this.subClient.quit()]);
  }
}
