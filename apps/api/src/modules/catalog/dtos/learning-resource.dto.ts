import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const RESOURCE_TYPES = [
  'udemy_course',
  'youtube_video',
  'official_documentation',
  'github_repository',
  'pdf',
  'article',
  'book',
  'other',
];

export class CreateLearningResourceDto {
  @IsIn(RESOURCE_TYPES)
  resourceType!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  author?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}

// `version` is supplied via the `If-Match` header.
export class UpdateLearningResourceDto {
  @IsOptional()
  @IsIn(RESOURCE_TYPES)
  resourceType?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  author?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}
