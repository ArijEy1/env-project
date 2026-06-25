import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { QuestionGenerationService } from './question-generation.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { DraftMaintenanceService } from './draft-maintenance.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    QuestionGenerationService,
    RecommendationEngineService,
    DraftMaintenanceService,
  ],
  exports: [AssessmentService, DraftMaintenanceService],
})
export class AssessmentModule {}
