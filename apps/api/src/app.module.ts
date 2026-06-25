import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, AssessmentModule, AdminModule],
})
export class AppModule {}
