import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Action endpoints (publish/retire) carry `version` in the body, per
// docs/api-specification.md §4.4 (`{ "version":2 }`) — unlike PATCH, which
// uses the `If-Match` header. `reason` is optional audit context.
export class FellowshipTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class DuplicateFellowshipDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsOptional()
  @IsUUID()
  academyId?: string;
}

export class CreateFellowshipDto {
  @IsUUID()
  academyId!: string;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsInt()
  @Min(1)
  @Max(52)
  durationWeeks!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  summary?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @IsOptional()
  @IsObject()
  eligibilityMetadata?: Record<string, unknown>;
}

// `version` is supplied via the `If-Match` header. Status transitions
// (publish/retire) go through their own /actions endpoints.
export class UpdateFellowshipDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  durationWeeks?: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  summary?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @IsOptional()
  @IsObject()
  eligibilityMetadata?: Record<string, unknown>;
}
