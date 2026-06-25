import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RecommendationEngineService } from '../assessment/recommendation-engine.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService, RecommendationEngineService],
})
export class AdminModule {}
