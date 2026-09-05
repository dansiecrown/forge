import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreatePracticalTaskDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsObject()
  submissionTypeMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueOffsetDays?: number;

  @IsOptional()
  @IsObject()
  rubricMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxScore?: number;
}

// `version` is supplied via the `If-Match` header.
export class UpdatePracticalTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsObject()
  submissionTypeMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueOffsetDays?: number;

  @IsOptional()
  @IsObject()
  rubricMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxScore?: number;
}
