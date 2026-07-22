import { ArrayUnique, IsArray, IsInt, IsString, Length, Matches, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  key!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds!: string[];
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds!: string[];

  @IsInt()
  @Min(1)
  version!: number;
}
