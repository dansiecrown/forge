import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  studentUserId!: string;
}

// `version` is supplied via the `If-Match` header.
export class UpdateEnrollmentDto {
  @IsIn(['invited', 'active', 'paused', 'completed', 'withdrawn'])
  status!: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
