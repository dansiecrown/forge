import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateMembershipStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  reason?: string;
}
