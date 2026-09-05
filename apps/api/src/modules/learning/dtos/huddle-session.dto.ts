import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

export class UpsertHuddleSessionDto {
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  discussionTopics?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  actionItems?: string[];
}

export class HuddleAttendanceEntryDto {
  @IsUUID()
  enrollmentId!: string;

  @IsIn(['present', 'absent', 'excused'])
  status!: 'present' | 'absent' | 'excused';
}

export class RecordHuddleAttendanceDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => HuddleAttendanceEntryDto)
  entries!: HuddleAttendanceEntryDto[];
}
