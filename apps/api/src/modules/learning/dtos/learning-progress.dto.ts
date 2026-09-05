import { IsOptional, IsUUID, IsUrl } from 'class-validator';

export class RecordLessonCompletionDto {
  @IsUUID()
  enrollmentId!: string;
}

export class RecordResourceAcknowledgmentDto {
  @IsUUID()
  enrollmentId!: string;
}

export class SaveTaskSubmissionDraftDto {
  @IsUUID()
  enrollmentId!: string;

  @IsOptional()
  @IsUrl()
  repositoryUrl?: string;

  @IsOptional()
  @IsUrl()
  liveDemoUrl?: string;
}

export class SubmitTaskDto {
  @IsUUID()
  enrollmentId!: string;
}
