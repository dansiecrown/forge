import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

const ANNOUNCEMENT_SCOPES = ['platform', 'organization', 'academy', 'cohort'] as const;

export class CreateAnnouncementDto {
  @IsEnum(ANNOUNCEMENT_SCOPES)
  scope!: (typeof ANNOUNCEMENT_SCOPES)[number];

  @IsOptional()
  @IsUUID()
  academyId?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(1, 5000)
  body!: string;
}

export class AnnouncementTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;
}
