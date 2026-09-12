import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateCohortDto {
  @IsUUID()
  fellowshipId!: string;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsString()
  timezone!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDeadline?: string;
}

// `version` is supplied via the `If-Match` header. Delivery-state changes
// (activate/pause/complete) go through their own /actions endpoints.
export class UpdateCohortDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDeadline?: string;

  // `enrolling`/`archived` are the two Cohort lifecycle transitions not
  // covered by a dedicated /actions endpoint (activate/pause/complete cover
  // the rest) — set directly via PATCH per the doc's own PATCH sample
  // (`"status":"enrolling"`). Validated as a state transition in the service.
  @IsOptional()
  @IsIn(['enrolling', 'archived'])
  status?: 'enrolling' | 'archived';
}

export class AssignCohortMentorDto {
  @IsUUID()
  membershipId!: string;
}

export class SetCohortTracksDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  learningTrackIds!: string[];
}

// Action endpoints (activate/pause/complete) carry `version` in the body,
// per docs/api-specification.md §4.6 (`{ "reason":"…","version":2 }`).
export class CohortTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
