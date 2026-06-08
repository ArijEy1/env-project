import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, AssessmentModule, AdminModule],
})
export class AppModule {}
