import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { QuestionGenerationService } from './question-generation.service';
import { RecommendationEngineService } from './recommendation-engine.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    QuestionGenerationService,
    RecommendationEngineService,
  ],
  exports: [AssessmentService],
})
export class AssessmentModule {}
