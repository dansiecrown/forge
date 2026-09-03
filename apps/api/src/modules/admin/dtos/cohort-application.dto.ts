import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class SubmitProspectApplicationDto {
  @IsUUID()
  cohortId!: string;

  @IsEmail()
  prospectEmail!: string;

  @IsString()
  @Length(1, 160)
  prospectDisplayName!: string;

  @IsOptional()
  @IsUUID()
  requestedLearningTrackId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class SubmitStudentApplicationDto {
  @IsUUID()
  cohortId!: string;

  @IsOptional()
  @IsUUID()
  requestedLearningTrackId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class CohortApplicationTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
