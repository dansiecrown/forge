import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import { ValidationPipe, type INestApplicationContext } from '@nestjs/common';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

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
