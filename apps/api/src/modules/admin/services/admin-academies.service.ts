import { Injectable } from '@nestjs/common';
import { AcademiesService } from '../../organizations/services/academies.service';
import { FellowshipsService } from '../../catalog/services/fellowships.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';

/** Academy statistics/mentor-allocation and the archive-validation check
 * both need `catalog` (Fellowship) data alongside `organizations` (Academy)
 * data — the one genuine cross-chain composition `AdminModule` exists for.
 * See docs/adr/0009-administration-platform.md Decision 2. */
@Injectable()
export class AdminAcademiesService {
  constructor(
    private readonly academiesService: AcademiesService,
    private readonly fellowshipsService: FellowshipsService,
    private readonly adminStatsRepository: AdminStatsRepository,
  ) {}

  /** `academiesService.get()` is used purely as an existence + hierarchy-scope
   * guard here (Milestone 7, closes DEBT-015) — an Academy Admin querying
   * stats for an academy outside their own, or in another organization,
   * gets the same 404 the resource endpoints already give. */
  async getStats(scope: TenantScope, academyId: string, callerId: string) {
    await this.academiesService.get(scope, academyId, callerId);
    return this.adminStatsRepository.getAcademyStats(academyId);
  }

  async getMentorAllocation(scope: TenantScope, academyId: string, callerId: string) {
    await this.academiesService.get(scope, academyId, callerId);
    return this.adminStatsRepository.getAcademyMentorAllocation(academyId);
  }

  /** Runs the child-state check first, then calls straight through to the
   * unmodified `AcademiesService.archive()`. The pre-existing
   * `POST /academies/:id/actions/archive` route is left as-is (no child
   * check, same as today, no existing test breaks) — this is a second,
   * admin-authoritative entry point. */
  async archiveWithValidation(scope: TenantScope, academyId: string, actorUserId: string) {
    const openFellowships = await this.fellowshipsService.list(
      scope,
      { academyId, status: 'published', limit: '1' },
      actorUserId,
    );
    if (openFellowships.items.length > 0) {
      throw AppException.conflict(
        'ACADEMY_HAS_ACTIVE_FELLOWSHIPS',
        'Retire all published fellowships in this academy before archiving it.',
      );
    }
    return this.academiesService.archive(scope, academyId, actorUserId);
  }
}
