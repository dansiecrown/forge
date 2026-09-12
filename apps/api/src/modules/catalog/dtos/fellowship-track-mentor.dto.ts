import { IsUUID } from 'class-validator';

export class AssignFellowshipTrackMentorDto {
  @IsUUID()
  membershipId!: string;
}
