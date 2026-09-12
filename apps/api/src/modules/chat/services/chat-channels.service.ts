import { Injectable } from '@nestjs/common';
import type { ChatChannelType } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { RedisEventsService } from './redis-events.service';
import { ChatAccessService } from './chat-access.service';
import {
  ChatChannelVersionConflictError,
  ChatChannelsRepository,
} from '../repositories/chat-channels.repository';
import { toChatChannelEntity, type ChatChannelEntity } from '../entities/chat-channel.entity';
import {
  toChatChannelMemberEntity,
  type ChatChannelMemberEntity,
} from '../entities/chat-channel-member.entity';

export interface CreateChatChannelInput {
  name: string;
  slug: string;
  description?: string;
  type?: ChatChannelType;
  isPrivate?: boolean;
}

/** `list()`'s response — the channel array plus the caller's own
 * capabilities *for this specific Fellowship*, added 2026-09-12 so the
 * frontend can decide whether to show a "Create channel" action without a
 * static, org-wide permission check (which can't express "this Mentor may
 * create channels here, but only here"). A breaking change to this
 * endpoint's response shape (previously a bare array) — see
 * docs/adr/0014-fellowship-chat.md's 2026-09-12 addendum. */
export interface ListChatChannelsResult {
  channels: ChatChannelEntity[];
  canManageChannels: boolean;
  canCreateChannels: boolean;
}

@Injectable()
export class ChatChannelsService {
  constructor(
    private readonly channelsRepository: ChatChannelsRepository,
    private readonly accessService: ChatAccessService,
    private readonly auditLog: AuditLogService,
    private readonly events: RedisEventsService,
  ) {}

  /** Called once, synchronously, from `FellowshipsService.create()` — see
   * docs/adr/0014-fellowship-chat.md Decision 4. Not exposed over HTTP. */
  async createDefaultGeneralChannel(
    organizationId: string,
    fellowshipId: string,
  ): Promise<ChatChannelEntity> {
    const channel = await this.channelsRepository.create({
      organizationId,
      fellowshipId,
      name: 'general',
      slug: 'general',
      type: 'general',
      description: 'The default channel for this fellowship.',
    });
    return toChatChannelEntity(channel);
  }

  /** Auto-created when a Cohort is assigned a Learning Track — see
   * `CohortsService.setOfferedTracks()`, the sole caller, which wraps this
   * in try/catch exactly like `createDefaultGeneralChannel()`'s own caller
   * does (never blocks the track-assignment action itself). Idempotent:
   * returns the existing channel rather than creating a second one if this
   * exact (cohort, track) pair already has one. The slug embeds the
   * cohort's own slug, not just the track's, because the same Fellowship-
   * level Track can be offered by more than one Cohort — each needs its own
   * channel and its own fellowship-unique slug. See
   * docs/adr/0014-fellowship-chat.md's 2026-09-12 addendum. */
  async createTrackChannel(
    organizationId: string,
    fellowshipId: string,
    cohort: { id: string; slug: string },
    track: { id: string; name: string; slug: string },
  ): Promise<ChatChannelEntity> {
    const existing = await this.channelsRepository.findByCohortAndTrack(cohort.id, track.id);
    if (existing) {
      return toChatChannelEntity(existing);
    }
    const channel = await this.channelsRepository.create({
      organizationId,
      fellowshipId,
      name: track.name,
      slug: `track-${cohort.slug}-${track.slug}`,
      type: 'track',
      description: `Discussion for the ${track.name} track.`,
      cohortId: cohort.id,
      learningTrackId: track.id,
    });
    return toChatChannelEntity(channel);
  }

  /** `includeArchived` is honored only for a caller who actually holds
   * `chat.channel.manage` for this Fellowship — passing it as a non-manager
   * is silently ignored rather than rejected, matching this codebase's
   * existing "permissive query param" convention elsewhere. Needed so a
   * manager can find an archived channel to restore it; nobody else has a
   * reason to see one. */
  async list(
    scope: TenantScope,
    userId: string,
    fellowshipId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ListChatChannelsResult> {
    const authorization = await this.accessService.authorize(scope, userId, fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Fellowship not found.');
    }
    const channels = await this.channelsRepository.listByFellowship(
      fellowshipId,
      Boolean(options.includeArchived) && authorization.canManageChannels,
    );
    // A plain Student sees only the `type: 'track'` channel for their own
    // Cohort+Track, never every track channel in the Fellowship — everyone
    // who can create channels (every admin, and a Mentor per the
    // 2026-09-12 addendum) is unrestricted here, matching how they already
    // see every other channel type. Fetched lazily: only when there's
    // actually a track channel to filter, and only for a caller who could
    // possibly need filtering.
    const hasTrackChannel = channels.some((channel) => channel.type === 'track');
    const studentTrackKeys =
      hasTrackChannel && !authorization.canCreateChannels
        ? await this.channelsRepository.listStudentTrackKeys(userId, fellowshipId)
        : null;

    const visible: typeof channels = [];
    for (const channel of channels) {
      if (
        studentTrackKeys &&
        channel.type === 'track' &&
        !studentTrackKeys.has(`${channel.cohortId}:${channel.learningTrackId}`)
      ) {
        continue;
      }
      if (!channel.isPrivate || authorization.canManageChannels) {
        visible.push(channel);
        continue;
      }
      if (await this.channelsRepository.isMember(channel.id, userId)) {
        visible.push(channel);
      }
    }
    return {
      channels: visible.map(toChatChannelEntity),
      canManageChannels: authorization.canManageChannels,
      canCreateChannels: authorization.canCreateChannels,
    };
  }

  /** Gated on `canCreateChannels`, not `canManageChannels` — a Mentor may
   * create a channel in a Fellowship they're assigned to (2026-09-12
   * addendum) without gaining rename/archive/restore power over it or
   * anyone else's channels; those stay behind `requireManageAccess` below,
   * unchanged. */
  async create(
    scope: TenantScope,
    userId: string,
    fellowshipId: string,
    input: CreateChatChannelInput,
  ): Promise<ChatChannelEntity> {
    const authorization = await this.accessService.authorize(scope, userId, fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Fellowship not found.');
    }
    if (!authorization.canCreateChannels) {
      throw AppException.forbidden();
    }
    if (input.type === 'track') {
      // `type: 'track'` channels always carry a `cohortId`/`learningTrackId`
      // pair — the whole visibility model in `list()`/`requireReadAccess()`
      // depends on it. Only `createTrackChannel()` (called from
      // `CohortsService.setOfferedTracks()`) may create one; allowing it
      // through this generic, free-form endpoint would produce a channel
      // with no cohort/track association that no Student could ever see.
      throw AppException.validation([
        {
          field: 'type',
          code: 'TRACK_CHANNEL_NOT_MANUAL',
          message: 'Track channels are created automatically when a cohort is assigned a track.',
        },
      ]);
    }

    const existing = await this.channelsRepository.findByFellowshipAndSlug(
      fellowshipId,
      input.slug,
    );
    if (existing) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'A channel with this slug already exists in this fellowship.',
      );
    }

    const channel = await this.channelsRepository.create({
      organizationId: scope.organizationId,
      fellowshipId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      type: input.type,
      isPrivate: input.isPrivate,
    });

    await this.auditLog.record({
      action: 'chat_channel.created',
      entityType: 'fellowship_chat_channel',
      entityId: channel.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: userId,
      metadata: { fellowshipId, slug: channel.slug },
    });

    const entity = toChatChannelEntity(channel);
    await this.events.publish({
      event: 'chat.channel.updated',
      fellowshipId,
      channelId: channel.id,
      payload: entity,
    });
    return entity;
  }

  /** Unauthenticated existence lookup — used only by the gateway's own
   * subscribe handler, which needs a channel's `fellowshipId` *before* it
   * can call `ChatAccessService.authorize()` at all. Never exposed
   * directly; every REST path goes through `get()` below instead. */
  async getById(id: string): Promise<ChatChannelEntity | null> {
    const channel = await this.channelsRepository.findById(id);
    return channel ? toChatChannelEntity(channel) : null;
  }

  async get(scope: TenantScope, userId: string, channelId: string): Promise<ChatChannelEntity> {
    const { channel } = await this.requireReadAccess(scope, userId, channelId);
    return toChatChannelEntity(channel);
  }

  /** The roster backing "start a DM with someone in this channel" — every
   * participant with read access (not just managers) may see it, since the
   * whole point is any participant can find anyone else here. Membership
   * rows are populated by `ChatMembershipSyncService` for students only (see
   * that service's doc comment); mentors and admins are simply never in this
   * list yet, a disclosed limitation, not a bug. */
  async listMembers(
    scope: TenantScope,
    userId: string,
    channelId: string,
  ): Promise<ChatChannelMemberEntity[]> {
    const { channel } = await this.requireReadAccess(scope, userId, channelId);
    const members = await this.channelsRepository.listMembers(channel.id);
    return members.map(toChatChannelMemberEntity);
  }

  private async requireReadAccess(scope: TenantScope, userId: string, channelId: string) {
    const channel = await this.channelsRepository.findById(channelId);
    if (!channel || channel.organizationId !== scope.organizationId) {
      throw AppException.notFound('Channel not found.');
    }
    const authorization = await this.accessService.authorize(scope, userId, channel.fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Channel not found.');
    }
    if (channel.isPrivate && !authorization.canManageChannels) {
      const isMember = await this.channelsRepository.isMember(channel.id, userId);
      if (!isMember) {
        throw AppException.notFound('Channel not found.');
      }
    }
    // Mirrors `list()`'s own track-channel filter — a plain Student must
    // not be able to reach a track channel that isn't theirs by guessing or
    // reusing its id (this is also what the WebSocket gateway's `subscribe`
    // handler and `ChatMessagesService` ultimately gate on, per Decision 3
    // — this is the single check both paths share).
    if (channel.type === 'track' && !authorization.canCreateChannels) {
      const studentTrackKeys = await this.channelsRepository.listStudentTrackKeys(
        userId,
        channel.fellowshipId,
      );
      if (!studentTrackKeys.has(`${channel.cohortId}:${channel.learningTrackId}`)) {
        throw AppException.notFound('Channel not found.');
      }
    }
    return { channel, authorization };
  }

  async update(
    scope: TenantScope,
    userId: string,
    channelId: string,
    input: { name?: string; description?: string },
    expectedVersion: number,
  ): Promise<ChatChannelEntity> {
    const { channel } = await this.requireManageAccess(scope, userId, channelId);
    try {
      const updated = await this.channelsRepository.update(channel.id, input, expectedVersion);
      const entity = toChatChannelEntity(updated);
      await this.auditLog.record({
        action: 'chat_channel.updated',
        entityType: 'fellowship_chat_channel',
        entityId: channel.id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: userId,
      });
      await this.events.publish({
        event: 'chat.channel.updated',
        fellowshipId: channel.fellowshipId,
        channelId: channel.id,
        payload: entity,
      });
      return entity;
    } catch (error) {
      throw translateVersionConflict(error);
    }
  }

  async setArchived(
    scope: TenantScope,
    userId: string,
    channelId: string,
    archived: boolean,
    expectedVersion: number,
  ): Promise<ChatChannelEntity> {
    const { channel } = await this.requireManageAccess(scope, userId, channelId);
    try {
      const updated = await this.channelsRepository.setArchived(
        channel.id,
        archived,
        expectedVersion,
      );
      const entity = toChatChannelEntity(updated);
      await this.auditLog.record({
        action: archived ? 'chat_channel.archived' : 'chat_channel.restored',
        entityType: 'fellowship_chat_channel',
        entityId: channel.id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: userId,
      });
      await this.events.publish({
        event: 'chat.channel.updated',
        fellowshipId: channel.fellowshipId,
        channelId: channel.id,
        payload: entity,
      });
      return entity;
    } catch (error) {
      throw translateVersionConflict(error);
    }
  }

  private async requireManageAccess(scope: TenantScope, userId: string, channelId: string) {
    const channel = await this.channelsRepository.findById(channelId);
    if (!channel || channel.organizationId !== scope.organizationId) {
      throw AppException.notFound('Channel not found.');
    }
    const authorization = await this.accessService.authorize(scope, userId, channel.fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Channel not found.');
    }
    if (!authorization.canManageChannels) {
      throw AppException.forbidden();
    }
    return { channel, authorization };
  }
}

function translateVersionConflict(error: unknown): never {
  if (error instanceof ChatChannelVersionConflictError) {
    throw AppException.conflict(
      'VERSION_CONFLICT',
      `Channel has moved to version ${error.currentVersion}.`,
    );
  }
  throw error;
}
