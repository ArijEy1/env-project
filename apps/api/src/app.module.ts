import { Module } from '@nestjs/common';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, AssessmentModule],
})
export class AppModule {}
