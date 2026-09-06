import { IsString, IsUUID, Length } from 'class-validator';

export class StartDirectConversationDto {
  @IsUUID()
  userId!: string;
}

export class CreateDirectMessageDto {
  @IsString()
  @Length(1, 4000)
  content!: string;
}
