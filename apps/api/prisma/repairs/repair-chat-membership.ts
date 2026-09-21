// Milestone 10 (post-launch stabilization) — one-time reconciliation, not a
// seed. `ChatMembershipSyncService.backfillTrackChannelRoster()` (added
// Milestone 8) only backfills a track channel's roster at the moment that
// channel is *newly created* — a channel that already existed before that
// fix shipped, with students/mentors already attached to it, never got its
// roster reconciled. A live data-integrity audit this milestone found
// exactly this: an enrolled student, selected into a track whose channel
// predates the fix, missing from that channel's member roster.
//
// This never changes who can *read/write* a channel — that has always been
// computed live from Enrollment/CohortMentor state, never from this roster
// table (see ChatMembershipSyncService's own file-level doc comment). It
// only makes the "who's in this channel" roster (`GET
// /chat/channels/:id/members`) match reality for every existing channel, not
// just ones created after Milestone 8.
//
// Idempotent — every write is `addMember()`'s own upsert (create-or-noop).
// Safe to re-run any time, including in production, as a standing
// reconciliation pass rather than a one-off migration, since it never
// deletes anything and never touches a table this doesn't own.
//
// Run with:
//   pnpm --filter @forge/api exec ts-node --transpile-only prisma/repairs/repair-chat-membership.ts
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

async function main() {
  const trackChannels = await prisma.fellowshipChatChannel.findMany({
    where: { type: 'track', archivedAt: null },
    select: { id: true, name: true, cohortId: true, learningTrackId: true },
  });

  let totalAdded = 0;
  for (const channel of trackChannels) {
    if (!channel.cohortId || !channel.learningTrackId) continue;

    const [enrollments, mentors] = await Promise.all([
      prisma.enrollment.findMany({
        where: {
          cohortId: channel.cohortId,
          currentLearningTrackId: channel.learningTrackId,
          status: { in: ['active', 'paused', 'completed'] },
        },
        select: { userId: true },
      }),
      prisma.cohortMentor.findMany({
        where: { cohortId: channel.cohortId, unassignedAt: null },
        select: { membership: { select: { userId: true } } },
      }),
    ]);

    const entitledUserIds = new Set<string>([
      ...enrollments.map((e) => e.userId),
      ...mentors.map((m) => m.membership.userId),
    ]);

    for (const userId of entitledUserIds) {
      await prisma.fellowshipChatChannelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId } },
        create: { channelId: channel.id, userId },
        update: {},
      });
    }

    const membersAfter = await prisma.fellowshipChatChannelMember.count({
      where: { channelId: channel.id },
    });
    console.log(
      `${channel.name} (${channel.id}): ${entitledUserIds.size} entitled, ${membersAfter} now in roster`,
    );
    totalAdded += entitledUserIds.size;
  }

  console.log(
    `\nReconciled ${trackChannels.length} track channels, ${totalAdded} entitlement checks.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
