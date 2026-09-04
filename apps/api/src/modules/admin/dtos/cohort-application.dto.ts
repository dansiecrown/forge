import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitProspectApplicationDto {
  @IsUUID()
  cohortId!: string;

  @IsEmail()
  prospectEmail!: string;

  @IsString()
  @Length(1, 160)
  prospectDisplayName!: string;

  @IsOptional()
  @IsUUID()
  requestedLearningTrackId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class SubmitStudentApplicationDto {
  @IsUUID()
  cohortId!: string;

  @IsOptional()
  @IsUUID()
  requestedLearningTrackId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class CohortApplicationTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

// Same shape/validation precedent as curriculum's ReorderDto/ReorderItemDto
// (apps/api/src/modules/catalog/dtos/curriculum-shared.dto.ts) — an array of
// per-item version stamps, not a bare id list, since approve/reject are each
// optimistic-concurrency-checked individually.
export class BulkCohortApplicationItemDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class BulkCohortApplicationActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkCohortApplicationItemDto)
  items!: BulkCohortApplicationItemDto[];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
