import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateChatMessageDto {
  @IsString()
  @Length(1, 4000)
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;
}

// No `version`/`If-Match` here, unlike most of this codebase's other
// editable resources — a chat message is only ever edited by its own
// author (enforced in the service, not by optimistic concurrency), so a
// last-write-wins update is the same behavior a real concurrent edit would
// produce anyway: the author's own second click winning over their first.
export class UpdateChatMessageDto {
  @IsString()
  @Length(1, 4000)
  content!: string;
}

export class AddChatReactionDto {
  @IsString()
  @Length(1, 32)
  reaction!: string;
}

export class MarkChannelReadDto {
  @IsOptional()
  @IsUUID()
  lastReadMessageId?: string;
}
