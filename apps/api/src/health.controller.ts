import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './decorators/public.decorator';

/** Liveness vs. readiness (Milestone 8 production hardening) — a container
 * orchestrator needs to tell "the process is up" apart from "the process
 * can actually serve traffic." `check()` (liveness) never touches the
 * database: a process that hasn't crashed is alive even mid-outage, and a
 * liveness probe failing during a real DB outage would cause an
 * orchestrator to kill and restart perfectly healthy API instances,
 * making the outage worse. `ready()` is the one that actually verifies
 * PostgreSQL is reachable, so a process with an unavailable required
 * database correctly reports itself as not ready rather than silently
 * accepting traffic it cannot serve. Redis is intentionally NOT part of
 * readiness: it's optional infrastructure for chat's real-time fan-out
 * (docs/adr/0014-fellowship-chat.md Decision 2) — the API is fully
 * functional, including chat's REST read/write paths, without it. */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'forge-api' };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        `Readiness check failed: database unreachable — ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Database is unreachable.',
      });
    }
    return { status: 'ok', service: 'forge-api' };
  }
}
