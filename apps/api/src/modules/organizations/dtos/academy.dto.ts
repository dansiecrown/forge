import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAcademyDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// `version` is supplied via the `If-Match` header. Status transitions
// (archive/restore) go through their own /actions endpoints.
export class UpdateAcademyDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AcademyActionReasonDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
