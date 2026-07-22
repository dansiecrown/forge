import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, Length } from 'class-validator';

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
