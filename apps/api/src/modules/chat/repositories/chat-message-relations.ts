import type { Prisma } from '@prisma/client';

/** Resolves the author's display name and (for a reply) a preview of the
 * parent message — so the API never hands the frontend a bare authorId,
 * same reasoning as `CohortApplicationsRepository`'s `APPLICATION_INCLUDE`. */
export const MESSAGE_INCLUDE = {
  author: { select: { displayName: true } },
  replyTo: {
    select: { content: true, author: { select: { displayName: true } } },
  },
  reactions: { select: { reaction: true, userId: true } },
} satisfies Prisma.FellowshipChatMessageInclude;

export type ChatMessageWithRelations = Prisma.FellowshipChatMessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;
