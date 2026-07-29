import { IsOptional, IsString, Length } from 'class-validator';

export class ApproveSubmissionDto {
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  comment?: string;
}

export class RequestRevisionDto {
  @IsString()
  @Length(1, 4000)
  comment!: string;
}
