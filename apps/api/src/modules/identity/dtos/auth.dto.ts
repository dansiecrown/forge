import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsBoolean()
  allSessions?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @Length(8, 128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Length(8, 128)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class ResendVerificationEmailDto {
  @IsEmail()
  email!: string;
}

export class MfaEnrollDto {
  @Matches(/^totp$/)
  type!: 'totp';
}

export class MfaVerifyDto {
  @IsOptional()
  @IsString()
  factorId?: string;

  @IsString()
  @Length(6, 8)
  code!: string;
}

export class ConfirmMfaEnrollmentDto {
  @IsString()
  factorId!: string;

  @IsString()
  @Length(6, 8)
  code!: string;
}

export class DisableMfaDto {
  @IsString()
  @Length(6, 10)
  code!: string;
}
