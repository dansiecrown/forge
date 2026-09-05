import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export class CreateLearningTrackDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsObject()
  iconMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104)
  estimatedWeeks?: number;

  @IsOptional()
  @IsObject()
  prerequisitesMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}

// `version` is supplied via the `If-Match` header; `slug` is immutable
// post-create, matching Fellowship/Academy's precedent.
export class UpdateLearningTrackDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsObject()
  iconMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104)
  estimatedWeeks?: number;

  @IsOptional()
  @IsObject()
  prerequisitesMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}
