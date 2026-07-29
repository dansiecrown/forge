import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
} from 'class-validator';

const LESSON_TYPES = [
  'video',
  'article',
  'documentation',
  'reading',
  'external_resource',
  'live_session_reference',
  'embedded_content',
];

export class CreateLessonDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsIn(LESSON_TYPES)
  lessonType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  resourceUrl?: string;

  @IsOptional()
  @IsObject()
  attachmentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  embeddedContentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  completionRequired?: boolean;
}

// `version` is supplied via the `If-Match` header.
export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsIn(LESSON_TYPES)
  lessonType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  resourceUrl?: string;

  @IsOptional()
  @IsObject()
  attachmentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  embeddedContentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  completionRequired?: boolean;
}
