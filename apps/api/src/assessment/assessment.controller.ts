import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AssessmentService } from './assessment.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest) {
    return this.assessmentService.create(req.user.sub);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.assessmentService.list(req.user.sub);
  }

  @Get('questions')
  getQuestions() {
    const { QUESTIONS, DOMAINS, ANSWER_OPTIONS, TOTAL_QUESTIONS } = require('./questions');
    return { questions: QUESTIONS, domains: DOMAINS, answerOptions: ANSWER_OPTIONS, totalQuestions: TOTAL_QUESTIONS };
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assessmentService.getById(id, req.user.sub);
  }

  @Put(':id/answer')
  saveAnswer(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.assessmentService.saveAnswer(id, req.user.sub, dto);
  }

  @Put(':id/progress')
  updateProgress(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.assessmentService.updateProgress(id, req.user.sub, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assessmentService.submit(id, req.user.sub);
  }
}
