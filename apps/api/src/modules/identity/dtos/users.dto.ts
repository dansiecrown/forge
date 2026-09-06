import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  displayName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  /** Self-service — same shape as the admin-set-at-creation field (see
   * CreateAdminUserDto); uniqueness enforced in UsersService.updateMe. */
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Username may only contain lowercase letters, numbers, "_", and "-".',
  })
  username?: string;
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 160)
  displayName!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roles?: string[];
}
