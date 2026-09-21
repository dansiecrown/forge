import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger, ValidationPipe, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { RedisService } from './redis/redis.service';
import { validationExceptionFactory } from './shared/validation/validation-exception-factory';

/** `@socket.io/redis-adapter` issues its own internal Redis subscribe
 * commands the moment `server.adapter(...)` attaches it — commands this
 * codebase has no call site to wrap in a `.catch()`, since they're issued
 * from inside the adapter library itself. When Redis is unreachable,
 * ioredis's `maxRetriesPerRequest` gives up on that command and rejects it;
 * on Node 18+, an unhandled rejection crashes the whole process by
 * default — which would mean a downed *optional* dependency (chat's
 * real-time layer) takes the *entire* API down with it, exactly the
 * failure mode the "handle Redis failure gracefully" requirement
 * (docs/adr/0014-fellowship-chat.md Decision 2) exists to prevent. Every
 * Redis error this codebase's own code produces is already caught and
 * logged (`RedisService`'s `.on('error')` handlers, `RedisEventsService`'s
 * `.catch()`s) — this is narrowly scoped to the one error class a
 * third-party library's internals can still raise unhandled, and anything
 * else still crashes the process exactly as Node's default behavior would. */
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.name === 'MaxRetriesPerRequestError') {
    return;
  }
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

/** Gives every socket.io namespace (just `/chat` today) the Redis adapter,
 * so `ChatGateway`'s `server.to(room).emit(...)` fans out across every API
 * instance subscribed to the same Redis, not only sockets connected to
 * *this* instance — see docs/adr/0014-fellowship-chat.md Decision 2. */
class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redis: RedisService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Record<string, unknown>) {
    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.redis.pubClient, this.redis.subClient));
    return server;
  }
}

/** Milestone 8 production hardening: neither of these is invalid enough to
 * fail startup over (both are legitimately optional per `env.validation.ts`
 * — an unconfigured SMTP host means requests keep working via the dev-mode
 * console-log stub, and a non-HTTPS `WEB_ORIGIN` is normal for local dev),
 * but silently shipping either to a real production deploy is a genuine
 * gap worth surfacing loudly rather than only in a runbook someone has to
 * remember to check. */
function warnAboutProductionMisconfiguration(config: AppConfigService, logger: Logger): void {
  if (config.app.nodeEnv !== 'production') return;
  if (!config.email.host) {
    logger.warn(
      'NODE_ENV=production but no SMTP_HOST is configured — password reset, email verification, ' +
        'and invitation emails will only be logged to the console, never actually delivered.',
    );
  }
  if (!config.app.webOrigin.startsWith('https://')) {
    logger.warn(
      `NODE_ENV=production but WEB_ORIGIN (${config.app.webOrigin}) is not an https:// origin — ` +
        'the Secure refresh-token cookie will still be sent, but CORS is allowing a non-HTTPS origin.',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');
  warnAboutProductionMisconfiguration(config, logger);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.app.webOrigin, credentials: true });
  app.use(cookieParser(config.auth.cookieSecret));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useWebSocketAdapter(new RedisIoAdapter(app, app.get(RedisService)));

  await app.listen(config.app.port);
}

void bootstrap();
