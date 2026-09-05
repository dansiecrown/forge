import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCertificateTemplateDto {
  @IsOptional()
  @IsUUID()
  fellowshipId?: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @Length(1, 20000)
  bodyHtml!: string;
}

export class IssueCertificateDto {
  @IsUUID()
  enrollmentId!: string;

  @IsUUID()
  certificateTemplateId!: string;
}

export class RevokeCertificateDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(1, 500)
  reason!: string;
}
