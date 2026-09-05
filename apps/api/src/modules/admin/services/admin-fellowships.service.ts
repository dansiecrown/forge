import { Injectable } from '@nestjs/common';
import { FellowshipsService } from '../../catalog/services/fellowships.service';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

const NON_TERMINAL_COHORT_STATUSES = ['draft', 'enrolling', 'active', 'paused'] as const;

/** The Fellowship half of the archive-validation composition — see
 * `AdminAcademiesService` and docs/adr/0009-administration-platform.md
 * Decision 2. */
@Injectable()
export class AdminFellowshipsService {
  constructor(
    private readonly fellowshipsService: FellowshipsService,
    private readonly cohortsService: CohortsService,
  ) {}

  async retireWithValidation(
    scope: TenantScope,
    fellowshipId: string,
    expectedVersion: number,
    actorUserId: string,
  ) {
    for (const status of NON_TERMINAL_COHORT_STATUSES) {
      const cohorts = await this.cohortsService.list(
        scope,
        { fellowshipId, status, limit: '1' },
        actorUserId,
      );
      if (cohorts.items.length > 0) {
        throw AppException.conflict(
          'FELLOWSHIP_HAS_ACTIVE_COHORTS',
          'Every cohort under this fellowship must be completed or archived before it can be retired.',
        );
      }
    }
    return this.fellowshipsService.retire(scope, fellowshipId, expectedVersion, actorUserId);
  }
}
