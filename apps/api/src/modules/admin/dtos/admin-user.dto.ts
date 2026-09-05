import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

/** Admin-driven edit of a Student/Mentor's own name + profile fields — the
 * name fields update `User` directly (via `UsersService.updateMe`), the rest
 * update `UserProfile` (via `UserProfilesService.update`, with the admin's
 * own id passed as the audit actor rather than the profile owner's). */
export class UpdateAdminUserProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  givenName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  availability?: string;
}

export class UpdateAdminUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  roleKeys!: string[];
}
