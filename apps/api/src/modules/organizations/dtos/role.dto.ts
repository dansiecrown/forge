import { ArrayUnique, IsArray, IsString, Length, Matches } from 'class-validator';

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

// `version` is supplied via the `If-Match` header (docs/api-specification.md
// §2), not the request body — see RolesController.update.
export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds!: string[];
}

export class CloneRoleDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  key!: string;
}
