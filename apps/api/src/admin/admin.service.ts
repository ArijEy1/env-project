import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { generateRecommendations } from '../assessment/recommendations';

interface EntityRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  cr_number: string;
  sector: string;
  city: string;
  region: string | null;
  created_at: Date | string;
  user_count: string;
  assessment_count: string;
}

interface EntityDetailRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  cr_number: string;
  sector: string;
  city: string;
  region: string | null;
  employee_count_bracket: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  unified_national_number: string | null;
  created_at: Date | string;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_role: string | null;
  role: string;
  created_at: Date | string;
}

interface AssessmentRow {
  id: string;
  entity_id: string;
  entity_name_ar: string;
  entity_name_en: string | null;
  user_full_name: string;
  status: string;
  total_score: string | null;
  maturity_level: number | null;
  current_question_index: number;
  created_at: Date | string;
  submitted_at: Date | string | null;
}

interface StatsRow {
  total_entities: string;
  total_users: string;
  total_assessments: string;
  submitted_assessments: string;
  average_score: string | null;
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getStats() {
    const result = await this.db.query<StatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM entities WHERE cr_number != 'SYSTEM-000001') as total_entities,
        (SELECT COUNT(*) FROM users WHERE role != 'superadmin') as total_users,
        (SELECT COUNT(*) FROM assessments) as total_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'submitted') as submitted_assessments,
        (SELECT ROUND(AVG(total_score)::numeric, 2) FROM assessments WHERE status = 'submitted') as average_score
    `);

    const row = result.rows[0];
    return {
      totalEntities: Number(row.total_entities),
      totalUsers: Number(row.total_users),
      totalAssessments: Number(row.total_assessments),
      submittedAssessments: Number(row.submitted_assessments),
      averageScore: row.average_score ? Number(row.average_score) : null,
    };
  }

  async listEntities() {
    const result = await this.db.query<EntityRow>(`
      SELECT
        e.id, e.name_ar, e.name_en, e.cr_number, e.sector, e.city, e.region, e.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.entity_id = e.id AND u.role != 'superadmin') as user_count,
        (SELECT COUNT(*) FROM assessments a WHERE a.entity_id = e.id) as assessment_count
      FROM entities e
      WHERE e.cr_number != 'SYSTEM-000001'
      ORDER BY e.created_at DESC
    `);

    return result.rows.map((r) => ({
      id: r.id,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      crNumber: r.cr_number,
      sector: r.sector,
      city: r.city,
      region: r.region,
      createdAt: this.toIso(r.created_at),
      userCount: Number(r.user_count),
      assessmentCount: Number(r.assessment_count),
    }));
  }

  async getEntity(entityId: string) {
    const entityResult = await this.db.query<EntityDetailRow>(
      `SELECT id, name_ar, name_en, cr_number, sector, city, region,
              employee_count_bracket, contact_email, contact_phone,
              unified_national_number, created_at
       FROM entities WHERE id = $1`,
      [entityId],
    );

    if (!entityResult.rows[0]) {
      throw new NotFoundException('Entity not found');
    }

    const e = entityResult.rows[0];

    const usersResult = await this.db.query<UserRow>(
      `SELECT id, full_name, email, phone, job_role, role, created_at
       FROM users WHERE entity_id = $1 AND role != 'superadmin'
       ORDER BY created_at`,
      [entityId],
    );

    return {
      id: e.id,
      nameAr: e.name_ar,
      nameEn: e.name_en,
      crNumber: e.cr_number,
      sector: e.sector,
      city: e.city,
      region: e.region,
      employeeCountBracket: e.employee_count_bracket,
      contactEmail: e.contact_email,
      contactPhone: e.contact_phone,
      unifiedNationalNumber: e.unified_national_number,
      createdAt: this.toIso(e.created_at),
      users: usersResult.rows.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        jobRole: u.job_role,
        role: u.role,
        createdAt: this.toIso(u.created_at),
      })),
    };
  }

  async listAssessments() {
    const result = await this.db.query<AssessmentRow>(`
      SELECT
        a.id, a.entity_id, a.status, a.total_score, a.maturity_level,
        a.current_question_index, a.created_at, a.submitted_at,
        e.name_ar as entity_name_ar, e.name_en as entity_name_en,
        u.full_name as user_full_name
      FROM assessments a
      JOIN entities e ON a.entity_id = e.id
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);

    const countResults = await Promise.all(
      result.rows.map((r) =>
        this.db.query<{ count: string }>(
          'SELECT COUNT(*) as count FROM assessment_answers WHERE assessment_id = $1',
          [r.id],
        ),
      ),
    );

    return result.rows.map((r, i) => ({
      id: r.id,
      entityId: r.entity_id,
      entityNameAr: r.entity_name_ar,
      entityNameEn: r.entity_name_en,
      userFullName: r.user_full_name,
      status: r.status,
      totalScore: r.total_score ? Number(r.total_score) : null,
      maturityLevel: r.maturity_level,
      answeredCount: Number(countResults[i].rows[0].count),
      totalQuestions: 18,
      createdAt: this.toIso(r.created_at),
      submittedAt: r.submitted_at ? this.toIso(r.submitted_at) : null,
    }));
  }

  async getAssessmentDetail(assessmentId: string) {
    const assessment = await this.db.query<{
      id: string;
      entity_id: string;
      user_id: string;
      status: string;
      current_question_index: number;
      total_score: string | null;
      governance_score: string | null;
      compliance_score: string | null;
      maturity_level: number | null;
      created_at: Date | string;
      submitted_at: Date | string | null;
    }>(
      `SELECT id, entity_id, user_id, status, current_question_index,
              total_score, governance_score, compliance_score, maturity_level,
              created_at, submitted_at
       FROM assessments WHERE id = $1`,
      [assessmentId],
    );

    if (!assessment.rows[0]) {
      throw new NotFoundException('Assessment not found');
    }

    const row = assessment.rows[0];

    const answers = await this.db.query<{ question_id: string; score: number }>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    return {
      id: row.id,
      entityId: row.entity_id,
      userId: row.user_id,
      status: row.status,
      currentQuestionIndex: row.current_question_index,
      totalScore: row.total_score ? Number(row.total_score) : null,
      governanceScore: row.governance_score ? Number(row.governance_score) : null,
      complianceScore: row.compliance_score ? Number(row.compliance_score) : null,
      maturityLevel: row.maturity_level ?? null,
      createdAt: this.toIso(row.created_at),
      submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
      answers: answers.rows.map((a) => ({ questionId: a.question_id, score: a.score })),
    };
  }

  async getReportData(assessmentId: string) {
    const detail = await this.getAssessmentDetail(assessmentId);

    if (detail.status !== 'submitted') {
      throw new NotFoundException('Report only available for submitted assessments');
    }

    const entity = await this.db.query<{ name_ar: string; name_en: string | null }>(
      'SELECT name_ar, name_en FROM entities WHERE id = $1',
      [detail.entityId],
    );

    const recommendations = generateRecommendations(detail.answers);

    return {
      entityNameAr: entity.rows[0]?.name_ar ?? '',
      entityNameEn: entity.rows[0]?.name_en ?? null,
      submittedAt: detail.submittedAt ?? new Date().toISOString(),
      totalScore: detail.totalScore ?? 0,
      governanceScore: detail.governanceScore ?? 0,
      complianceScore: detail.complianceScore ?? 0,
      maturityLevel: detail.maturityLevel ?? 1,
      recommendations: recommendations.map((r) => ({
        rank: r.rank,
        questionTextAr: r.questionTextAr,
        score: r.score,
        actionAr: r.actionAr,
        impactAr: r.impactAr,
        referenceAr: r.referenceAr,
      })),
    };
  }

  private toIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }
}
