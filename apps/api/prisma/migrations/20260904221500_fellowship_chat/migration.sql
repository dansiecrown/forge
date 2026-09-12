-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('general', 'announcements', 'standard');

-- CreateTable
CREATE TABLE "fellowship_chat_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChatChannelType" NOT NULL DEFAULT 'standard',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fellowship_chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowship_chat_messages" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reply_to_message_id" TEXT,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fellowship_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowship_chat_message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fellowship_chat_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowship_chat_channel_members" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by_user_id" TEXT,

    CONSTRAINT "fellowship_chat_channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowship_chat_read_states" (
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "last_read_message_id" TEXT,
    "last_read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fellowship_chat_read_states_pkey" PRIMARY KEY ("user_id","channel_id")
);

-- CreateIndex
CREATE INDEX "fellowship_chat_channels_fellowship_id_archived_at_idx" ON "fellowship_chat_channels"("fellowship_id", "archived_at");

-- CreateIndex
CREATE INDEX "fellowship_chat_messages_channel_id_created_at_idx" ON "fellowship_chat_messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "fellowship_chat_messages_author_id_idx" ON "fellowship_chat_messages"("author_id");

-- CreateIndex
CREATE INDEX "fellowship_chat_messages_reply_to_message_id_idx" ON "fellowship_chat_messages"("reply_to_message_id");

-- CreateIndex
CREATE INDEX "fellowship_chat_message_reactions_message_id_idx" ON "fellowship_chat_message_reactions"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "fellowship_chat_message_reactions_message_id_user_id_reacti_key" ON "fellowship_chat_message_reactions"("message_id", "user_id", "reaction");

-- CreateIndex
CREATE UNIQUE INDEX "fellowship_chat_channel_members_channel_id_user_id_key" ON "fellowship_chat_channel_members"("channel_id", "user_id");

-- CreateIndex
CREATE INDEX "fellowship_chat_read_states_channel_id_idx" ON "fellowship_chat_read_states"("channel_id");

-- AddForeignKey
ALTER TABLE "fellowship_chat_channels" ADD CONSTRAINT "fellowship_chat_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_channels" ADD CONSTRAINT "fellowship_chat_channels_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_messages" ADD CONSTRAINT "fellowship_chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "fellowship_chat_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_messages" ADD CONSTRAINT "fellowship_chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_messages" ADD CONSTRAINT "fellowship_chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "fellowship_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_message_reactions" ADD CONSTRAINT "fellowship_chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "fellowship_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_message_reactions" ADD CONSTRAINT "fellowship_chat_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_channel_members" ADD CONSTRAINT "fellowship_chat_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "fellowship_chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_channel_members" ADD CONSTRAINT "fellowship_chat_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_read_states" ADD CONSTRAINT "fellowship_chat_read_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_read_states" ADD CONSTRAINT "fellowship_chat_read_states_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "fellowship_chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written partial unique index (WHERE archived_at IS NULL) — Prisma's
-- schema DSL cannot express this, same convention as Academy/Cohort/Fellowship
-- slug uniqueness (see migrations/20260725162854_multi_tenant_foundation).
CREATE UNIQUE INDEX "fellowship_chat_channels_fellowship_slug_active_key" ON "fellowship_chat_channels" ("fellowship_id", "slug") WHERE "archived_at" IS NULL;
