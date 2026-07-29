import { IsArray, IsInt, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Shared across all six curriculum entities (LearningTrack, Course,
// WeeklyModule, Lesson, LearningResource, PracticalTask) — one shared shape,
// matching the one shared `curriculum.*` permission namespace decision
// (docs/adr/0006-curriculum-learning-engine.md).

// Action endpoints (publish/archive/restore) carry `version` in the body,
// per the established action-endpoint convention (docs/adr/0005 Decision 10).
export class CurriculumTransitionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class ReorderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
