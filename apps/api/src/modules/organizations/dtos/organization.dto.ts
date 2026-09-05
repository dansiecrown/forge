import { IsEmail, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  legalName?: string;

  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;
}

// `version` is supplied via the `If-Match` header (docs/api-specification.md
// §2), not the request body. Status transitions (suspend/archive/restore)
// go through their own /actions endpoints, not this DTO.
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  legalName?: string;

  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  customDomain?: string;

  @IsOptional()
  @IsString()
  logoAssetId?: string;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class OrganizationActionReasonDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}
