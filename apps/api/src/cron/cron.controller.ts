import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
} from '@nestjs/common';
import { DraftMaintenanceService } from '../assessment/draft-maintenance.service';

/**
 * Serverless-friendly trigger for the hourly draft-maintenance job.
 *
 * On Vercel there is no long-running process, so the in-app @Cron never fires.
 * Vercel Cron instead calls GET /api/cron/maintenance on a schedule and, when a
 * CRON_SECRET env var is set, includes `Authorization: Bearer <CRON_SECRET>`.
 * We verify that secret so the endpoint can't be triggered by the public.
 */
@Controller('cron')
export class CronController {
  constructor(private readonly draftMaintenance: DraftMaintenanceService) {}

  @Get('maintenance')
  async maintenance(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    // If a secret is configured, require it. (If unset, the route is disabled to
    // avoid an unauthenticated maintenance trigger in production.)
    if (!secret) {
      throw new ForbiddenException('Cron is not configured');
    }
    if (authorization !== `Bearer ${secret}`) {
      throw new ForbiddenException('Invalid cron credentials');
    }
    const result = await this.draftMaintenance.runNow();
    return { ok: true, ...result };
  }
}
