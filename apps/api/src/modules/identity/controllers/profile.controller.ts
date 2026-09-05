import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { UpdateUserProfileDto } from '../dtos/user-profile.dto';
import { UserProfilesService } from '../services/user-profiles.service';

/** Separate from `MeController` for file-size hygiene — `MeController`
 * stays about core `User` fields, this is the distinct profile concern
 * (Milestone 5, Student Experience; generalized to any role in Milestone 6,
 * Mentor Experience — see docs/adr/0008-mentor-experience.md Decision 4).
 * Both mount under `/me`. */
@Controller('me/profile')
export class ProfileController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  @Get()
  getProfile(@CurrentUser() user: { id: string }) {
    return this.userProfilesService.get(user.id);
  }

  @Patch()
  updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateUserProfileDto) {
    return this.userProfilesService.update(user.id, dto);
  }
}
