import { ChatChannelType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateChatChannelDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 60)
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsEnum(ChatChannelType)
  type?: ChatChannelType;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class UpdateChatChannelDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class ChatChannelTransitionDto {
  @IsInt()
  version!: number;
}
