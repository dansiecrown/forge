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
  ): Promise<ChatChannelEntity[]> {
    const authorization = await this.accessService.authorize(scope, userId, fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Fellowship not found.');
    }
    const channels = await this.channelsRepository.listByFellowship(
      fellowshipId,
      Boolean(options.includeArchived) && authorization.canManageChannels,
    );
    const visible: typeof channels = [];
    for (const channel of channels) {
      if (!channel.isPrivate || authorization.canManageChannels) {
        visible.push(channel);
        continue;
      }
      if (await this.channelsRepository.isMember(channel.id, userId)) {
        visible.push(channel);
      }
    }
    return visible.map(toChatChannelEntity);
  }

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
    if (!authorization.canManageChannels) {
      throw AppException.forbidden();
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
