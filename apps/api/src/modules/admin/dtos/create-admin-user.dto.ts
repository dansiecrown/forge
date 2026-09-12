import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

/** Admin-set-password account creation — see this DTO's service,
 * `AdminUsersService.create`, and docs/adr/0009-administration-platform.md's
 * addendum for why this exists alongside (not instead of) the older
 * email-only `POST /users/invitations` flow. */
export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  /** Lowercase alphanumeric + `_`/`-`, 3-30 chars — a plain "handle" shape
   * the not-yet-built user-to-user chat lookup can reuse without a further
   * migration. Uniqueness is enforced in the service, not here. */
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Username may only contain lowercase letters, numbers, "_", and "-".',
  })
  username!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsString()
  @Length(1, 160)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  givenName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  familyName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  roleKeys!: string[];

  /** Required only when `roleKeys` includes `ACADEMY_ADMIN` — validated in
   * the service, since it's conditional on another field. */
  @IsOptional()
  @IsUUID()
  academyId?: string;
}
