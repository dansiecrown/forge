import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  platformName?: string;

  @IsOptional()
  @IsString()
  logoAssetId?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  defaultTheme?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;

  @IsOptional()
  @IsObject()
  passwordPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sessionPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  mfaPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
