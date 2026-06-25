import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { AuthEmailService } from '../auth/auth-email.service';

// Configurable so deployments can tune them; defaults match the spec.
const REMINDER_AFTER_DAYS = Number(process.env.DRAFT_REMINDER_DAYS ?? 3);
const RETENTION_DAYS = Number(process.env.DRAFT_RETENTION_DAYS ?? 30);

@Injectable()
export class DraftMaintenanceService {
  private readonly logger = new Logger(DraftMaintenanceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly email: AuthEmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled() {
    await this.sendInactivityReminders();
    await this.purgeExpiredDrafts();
  }

  /**
   * One reminder per inactive draft after REMINDER_AFTER_DAYS of inactivity.
   * reminder_sent_at guards against repeats; it resets to NULL when the user is
   * active again, so a fresh inactivity period earns a new reminder.
   */
  async sendInactivityReminders(): Promise<number> {
    const rows = await this.db.query<{ id: string; email: string; full_name: string }>(
      `SELECT a.id, u.email, u.full_name
       FROM assessments a
       JOIN users u ON u.id = a.user_id
       WHERE a.status = 'draft'
         AND a.reminder_sent_at IS NULL
         AND a.last_activity_at < NOW() - ($1 || ' days')::interval`,
      [String(REMINDER_AFTER_DAYS)],
    );

    let sent = 0;
    for (const r of rows.rows) {
      try {
        await this.email.sendDraftReminderEmail({ email: r.email, fullName: r.full_name });
        await this.db.query(
          'UPDATE assessments SET reminder_sent_at = NOW() WHERE id = $1',
          [r.id],
        );
        sent += 1;
      } catch (e) {
        this.logger.error(`Failed to send draft reminder for ${r.id}: ${String(e)}`);
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} draft inactivity reminder(s)`);
    return sent;
  }

  /** Deletes drafts inactive for more than RETENTION_DAYS (cascades answers). */
  async purgeExpiredDrafts(): Promise<number> {
    const res = await this.db.query(
      `DELETE FROM assessments
       WHERE status = 'draft'
         AND last_activity_at < NOW() - ($1 || ' days')::interval`,
      [String(RETENTION_DAYS)],
    );
    const count = res.rowCount ?? 0;
    if (count > 0) this.logger.log(`Purged ${count} expired draft assessment(s)`);
    return count;
  }

  async runNow(): Promise<{ remindersSent: number; draftsPurged: number }> {
    const remindersSent = await this.sendInactivityReminders();
    const draftsPurged = await this.purgeExpiredDrafts();
    return { remindersSent, draftsPurged };
  }
}
