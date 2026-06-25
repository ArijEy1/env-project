import { Body, Controller, Get, Param, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { generatePdfReport, generateReferenceNumber } from '../assessment/pdf-report';
import { DraftMaintenanceService } from '../assessment/draft-maintenance.service';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './superadmin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly draftMaintenance: DraftMaintenanceService,
  ) {}

  @Post('maintenance/run')
  runMaintenance() {
    return this.draftMaintenance.runNow();
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('entities')
  listEntities() {
    return this.adminService.listEntities();
  }

  @Get('entities/:id')
  getEntity(@Param('id') id: string) {
    return this.adminService.getEntity(id);
  }

  @Get('questions')
  listQuestions() {
    return this.adminService.listQuestions();
  }

  @Patch('questions/:id')
  updateQuestion(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.adminService.updateQuestion(id, dto);
  }

  @Get('recommendations')
  listRecommendations() {
    return this.adminService.listRecommendations();
  }

  @Put('recommendations/:id')
  updateRecommendation(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.adminService.updateRecommendation(id, dto);
  }

  @Get('regulatory-mappings')
  listRegulatoryMappings() {
    return this.adminService.listRegulatoryMappings();
  }

  @Get('assessments')
  listAssessments() {
    return this.adminService.listAssessments();
  }

  @Get('assessments/:id')
  getAssessment(@Param('id') id: string) {
    return this.adminService.getAssessmentDetail(id);
  }

  @Get('assessments/:id/report')
  async getReport(@Param('id') id: string, @Res() res: Response) {
    const data = await this.adminService.getReportData(id);
    const referenceNumber = generateReferenceNumber(data.submittedAt);
    const doc = generatePdfReport({ ...data, referenceNumber });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${referenceNumber}.pdf"`);
    doc.pipe(res);
    doc.end();
  }
}
