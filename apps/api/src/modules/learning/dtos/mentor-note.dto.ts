import { IsString, Length } from 'class-validator';

export class CreateMentorNoteDto {
  @IsString()
  @Length(1, 4000)
  body!: string;
}

export class UpdateMentorNoteDto {
  @IsString()
  @Length(1, 4000)
  body!: string;
}
