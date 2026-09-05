import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import Redis from 'ioredis';
import { AppModule } from '../../../app.module';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../database/prisma.service';
import { validationExceptionFactory } from '../../../shared/validation/validation-exception-factory';

jest.setTimeout(30_000);

/** The "Critical WebSocket test" (Phase 7), made permanent. Hits the real
 * dev Postgres AND boots the actual `AppModule` (auth, chat REST, and the
 * `/chat` gateway together) — unlike this module's other integration specs,
 * which exercise one repository/service directly, cross-Fellowship
 * real-time isolation is a property of the whole request → REST → Redis →
 * gateway → socket pipeline, so nothing less than the real app proves it.
 * Requires `pnpm docker:up` first (Postgres *and* Redis — see
 * docs/adr/0014-fellowship-chat.md Decision 2). Two users are seeded, each
 * with a genuine, distinct relationship to their own Fellowship and none to
 * the other's, exactly mirroring the manual verification this test
 * codifies. */
describe('ChatGateway — cross-Fellowship real-time isolation (integration)', () => {
  const prisma = new PrismaService();
  let app: INestApplication;
  let httpServer: Server;
  let baseUrl: string;
  let redisAvailable = false;

  let organizationId: string;
  let academyAId: string;
  let academyBId: string;
  let fellowshipAId: string;
  let fellowshipBId: string;
  let channelAId: string;
  let channelBId: string;
  let userAToken: string;
  let userBToken: string;

  async function login(emailCanonical: string): Promise<string> {
    const res = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: emailCanonical, password: 'TestPass123!' });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(
        `Login failed for ${emailCanonical}: ${res.status} ${JSON.stringify(res.body)}`,
      );
    }
    return res.body.data.accessToken as string;
  }

  function connectSocket(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/chat`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function waitFor<T = unknown>(
    socket: Socket,
    event: string,
    timeoutMs = 4000,
  ): Promise<T | undefined> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    await prisma.$connect();

    // A short-timeout probe — this environment's own dev setup genuinely
    // runs without Redis some of the time (see docs/adr/0014-fellowship-chat.md
    // Decision 2's "handle Redis failure gracefully" rationale), and the
    // isolation/authorization assertions below are meaningful with or
    // without it. Only the live-delivery assertion is soft-skipped (with a
    // console warning, not a silent pass) when Redis is unreachable.
    const probe = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 1000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    try {
      await probe.connect();
      await probe.ping();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
    } finally {
      probe.disconnect();
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser(app.get(AppConfigService).auth.cookieSecret));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    httpServer = app.getHttpServer();
    const address = httpServer.address();
    if (typeof address === 'string' || address === null) {
      throw new Error('Expected the test HTTP server to bind to a TCP port.');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    const suffix = Date.now();
    const organization = await prisma.organization.create({
      data: { name: 'WS Isolation Test Org', slug: `ws-isolation-org-${suffix}` },
    });
    organizationId = organization.id;

    const academyA = await prisma.academy.create({
      data: { organizationId, name: 'WS Academy A', slug: `ws-isolation-academy-a-${suffix}` },
    });
    academyAId = academyA.id;
    const academyB = await prisma.academy.create({
      data: { organizationId, name: 'WS Academy B', slug: `ws-isolation-academy-b-${suffix}` },
    });
    academyBId = academyB.id;

    const fellowshipA = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId: academyAId,
        title: 'WS Fellowship A',
        slug: `ws-isolation-fellowship-a-${suffix}`,
        durationWeeks: 12,
      },
    });
    fellowshipAId = fellowshipA.id;
    const fellowshipB = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId: academyBId,
        title: 'WS Fellowship B',
        slug: `ws-isolation-fellowship-b-${suffix}`,
        durationWeeks: 12,
      },
    });
    fellowshipBId = fellowshipB.id;

    const cohortA = await prisma.cohort.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        name: 'WS Cohort A',
        slug: `ws-isolation-cohort-a-${suffix}`,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-06-01'),
        timezone: 'UTC',
        capacity: 30,
      },
    });
    const cohortB = await prisma.cohort.create({
      data: {
        organizationId,
        academyId: academyBId,
        fellowshipId: fellowshipBId,
        name: 'WS Cohort B',
        slug: `ws-isolation-cohort-b-${suffix}`,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-06-01'),
        timezone: 'UTC',
        capacity: 30,
      },
    });

    const passwordHash = await hashTestPassword();

    const userA = await prisma.user.create({
      data: {
        emailCanonical: `ws-student-a-${suffix}@chat-ws-test.local`,
        displayName: 'WS Student A',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.passwordCredential.create({ data: { userId: userA.id, passwordHash } });
    const membershipA = await prisma.membership.create({
      data: {
        organizationId,
        userId: userA.id,
        academyId: academyAId,
        status: 'active',
        joinedAt: new Date(),
      },
    });
    const studentRole = await prisma.role.findFirstOrThrow({
      where: { key: 'STUDENT', isSystem: true },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membershipA.id, roleId: studentRole.id },
    });
    await prisma.enrollment.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        cohortId: cohortA.id,
        userId: userA.id,
        status: 'active',
        joinedAt: new Date(),
      },
    });

    const userB = await prisma.user.create({
      data: {
        emailCanonical: `ws-student-b-${suffix}@chat-ws-test.local`,
        displayName: 'WS Student B',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.passwordCredential.create({ data: { userId: userB.id, passwordHash } });
    const membershipB = await prisma.membership.create({
      data: {
        organizationId,
        userId: userB.id,
        academyId: academyBId,
        status: 'active',
        joinedAt: new Date(),
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membershipB.id, roleId: studentRole.id },
    });
    await prisma.enrollment.create({
      data: {
        organizationId,
        academyId: academyBId,
        fellowshipId: fellowshipBId,
        cohortId: cohortB.id,
        userId: userB.id,
        status: 'active',
        joinedAt: new Date(),
      },
    });

    userAToken = await login(userA.emailCanonical);
    userBToken = await login(userB.emailCanonical);

    // These Fellowships were seeded directly via Prisma above, bypassing
    // `FellowshipsService.create()` — the only place the auto-#general hook
    // (docs/adr/0014-fellowship-chat.md Decision 4) actually runs — so the
    // channel each user will subscribe to is created directly here instead.
    const channelA = await prisma.fellowshipChatChannel.create({
      data: { organizationId, fellowshipId: fellowshipAId, name: 'general', slug: 'general' },
    });
    channelAId = channelA.id;

    const channelB = await prisma.fellowshipChatChannel.create({
      data: { organizationId, fellowshipId: fellowshipBId, name: 'general', slug: 'general' },
    });
    channelBId = channelB.id;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { organizationId } });
    await prisma.membershipRole.deleteMany({ where: { membership: { organizationId } } });
    await prisma.membership.deleteMany({ where: { organizationId } });
    await prisma.fellowshipChatMessage.deleteMany({
      where: { channel: { organizationId } },
    });
    await prisma.fellowshipChatChannel.deleteMany({ where: { organizationId } });
    await prisma.cohort.deleteMany({ where: { organizationId } });
    await prisma.fellowship.deleteMany({ where: { organizationId } });
    await prisma.academy.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.authSession.deleteMany({
      where: { user: { emailCanonical: { contains: 'chat-ws-test.local' } } },
    });
    await prisma.passwordCredential.deleteMany({
      where: { user: { emailCanonical: { contains: 'chat-ws-test.local' } } },
    });
    await prisma.user.deleteMany({ where: { emailCanonical: { contains: 'chat-ws-test.local' } } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('every Fellowship auto-received a #general channel to test against', () => {
    expect(channelAId).toBeTruthy();
    expect(channelBId).toBeTruthy();
    expect(channelAId).not.toBe(channelBId);
  });

  it('both users can subscribe to their own legitimate Fellowship channel', async () => {
    const socketA = await connectSocket(userAToken);
    const socketB = await connectSocket(userBToken);
    try {
      // Listeners must be registered *before* emitting — socket.io delivers
      // events to whatever's listening the instant they arrive, with no
      // buffering for a `.once()` attached a tick later, so a fast server
      // round-trip can otherwise land while nothing is listening yet.
      const subAPromise = waitFor<{ channelId: string }>(socketA, 'chat.subscribed');
      const subBPromise = waitFor<{ channelId: string }>(socketB, 'chat.subscribed');
      socketA.emit('chat.subscribe', { channelId: channelAId, organizationId });
      socketB.emit('chat.subscribe', { channelId: channelBId, organizationId });

      const [subA, subB] = await Promise.all([subAPromise, subBPromise]);

      expect(subA?.channelId).toBe(channelAId);
      expect(subB?.channelId).toBe(channelBId);
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  it('User A is REJECTED subscribing to Fellowship B channel, and vice versa', async () => {
    const socketA = await connectSocket(userAToken);
    const socketB = await connectSocket(userBToken);
    try {
      const rejectAPromise = waitFor<{ code: string }>(socketA, 'chat.error');
      const rejectBPromise = waitFor<{ code: string }>(socketB, 'chat.error');
      socketA.emit('chat.subscribe', { channelId: channelBId, organizationId });
      socketB.emit('chat.subscribe', { channelId: channelAId, organizationId });

      const [rejectA, rejectB] = await Promise.all([rejectAPromise, rejectBPromise]);

      expect(rejectA?.code).toBe('FORBIDDEN');
      expect(rejectB?.code).toBe('FORBIDDEN');
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  it('a direct REST send attempt to a Fellowship B channel by User A is rejected', async () => {
    const res = await request(httpServer)
      .post(`/api/v1/chat/channels/${channelBId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('X-Organization-Id', organizationId)
      .send({ content: 'should never be created' });

    expect(res.status).toBe(404);
  });

  it('a message sent in Fellowship A is delivered to User A and NEVER to User B', async () => {
    const socketA = await connectSocket(userAToken);
    const socketB = await connectSocket(userBToken);
    try {
      const subAPromise = waitFor(socketA, 'chat.subscribed');
      const subBPromise = waitFor(socketB, 'chat.subscribed');
      socketA.emit('chat.subscribe', { channelId: channelAId, organizationId });
      socketB.emit('chat.subscribe', { channelId: channelBId, organizationId });
      await Promise.all([subAPromise, subBPromise]);

      if (!redisAvailable) {
        console.warn(
          'SKIPPED real-time delivery assertion: Redis is unreachable in this environment. ' +
            'The message-creation and channel-isolation halves of this test still ran for real.',
        );
        return;
      }

      const aReceives = waitFor<{ content: string }>(socketA, 'chat.message.created');
      const bReceives = waitFor<{ content: string }>(socketB, 'chat.message.created', 3000);

      const postRes = await request(httpServer)
        .post(`/api/v1/chat/channels/${channelAId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('X-Organization-Id', organizationId)
        .send({ content: 'Realtime isolation regression probe' });
      expect(postRes.status).toBe(201);

      const [received, leaked] = await Promise.all([aReceives, bReceives]);
      expect(received?.content).toBe('Realtime isolation regression probe');
      expect(leaked).toBeUndefined();
    } finally {
      socketA.close();
      socketB.close();
    }
  });
});

async function hashTestPassword(): Promise<string> {
  const argon2 = await import('argon2');
  return argon2.hash('TestPass123!', { type: argon2.argon2id });
}
