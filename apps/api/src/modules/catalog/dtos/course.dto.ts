import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @Length(1, 80)
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  overview?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  completionCriteria?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedHours?: number;
}

// `version` is supplied via the `If-Match` header; `slug` is immutable
// post-create.
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  overview?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  completionCriteria?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  estimatedHours?: number;
}
