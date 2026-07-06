import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { CronController } from './cron/cron.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AssessmentModule,
    AdminModule,
  ],
  // CronController injects DraftMaintenanceService, exported by AssessmentModule.
  controllers: [HealthController, CronController],
})
export class AppModule {}
