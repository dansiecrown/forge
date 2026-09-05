import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  studentUserId!: string;
}

// `version` is supplied via the `If-Match` header. `status` is optional so a
// PATCH can change just `currentLearningTrackId` (track selection) without
// also transitioning lifecycle status.
export class UpdateEnrollmentDto {
  @IsOptional()
  @IsIn(['invited', 'active', 'paused', 'completed', 'withdrawn'])
  status?: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';

  @IsOptional()
  @IsUUID()
  currentLearningTrackId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class SelectEnrollmentTrackDto {
  @IsUUID()
  learningTrackId!: string;
}
