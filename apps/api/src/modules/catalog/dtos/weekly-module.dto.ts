import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateWeeklyModuleDto {
  @IsInt()
  @Min(1)
  @Max(104)
  weekNumber!: number;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  summary?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedStudyHours?: number;

  @IsOptional()
  @IsBoolean()
  requiresMentorHuddle?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPracticalWork?: boolean;

  @IsOptional()
  @IsObject()
  unlockRules?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  huddleScheduleMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  huddleMeetingLink?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  mentorHuddleNotes?: string;

  @IsOptional()
  @IsBoolean()
  huddleAttendanceRequired?: boolean;
}

// `version` is supplied via the `If-Match` header. `weekNumber` is
// changeable here (unlike other entities' slugs) since renumbering a week
// is a legitimate authoring action, not an identity change — uniqueness is
// still enforced by the partial unique index.
export class UpdateWeeklyModuleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104)
  weekNumber?: number;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  summary?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedStudyHours?: number;

  @IsOptional()
  @IsBoolean()
  requiresMentorHuddle?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPracticalWork?: boolean;

  @IsOptional()
  @IsObject()
  unlockRules?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  huddleScheduleMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  huddleMeetingLink?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  mentorHuddleNotes?: string;

  @IsOptional()
  @IsBoolean()
  huddleAttendanceRequired?: boolean;
}
