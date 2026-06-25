import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RecommendationEngineService } from '../assessment/recommendation-engine.service';
import { buildReportData } from '../assessment/pdf-report';

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
  average_maturity: string | null;
}

interface SectorStatRow {
  sector: string;
  entity_count: string;
  completed: string;
  avg_maturity: string | null;
}

interface QuestionBankRow {
  id: string;
  domain_id: string;
  domain_name_en: string;
  text_ar: string;
  text_en: string;
  help_text_ar: string | null;
  help_text_en: string | null;
  materiality_topic_id: string | null;
  base_weight: string;
  calculator_type: string | null;
  active: boolean;
}

interface RecLibRow {
  id: string;
  materiality_topic_id: string | null;
  domain_id: string;
  trigger_max_score: number;
  immediate_action_ar: string;
  immediate_action_en: string;
  short_term_action_ar: string;
  short_term_action_en: string;
  medium_term_action_ar: string;
  medium_term_action_en: string;
  cost_estimate: string | null;
  effort_level: string;
  score_impact_points: number;
  timeline_weeks: number;
  legal_reference: string | null;
  active: boolean;
}

interface RegMapRow {
  id: string;
  bank_question_id: string;
  question_text_en: string | null;
  regulation: string;
  clause: string | null;
  authority: string | null;
  url: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly recommendationEngine: RecommendationEngineService,
  ) {}

  async getStats() {
    const result = await this.db.query<StatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM entities WHERE cr_number != 'SYSTEM-000001') as total_entities,
        (SELECT COUNT(*) FROM users WHERE role != 'superadmin') as total_users,
        (SELECT COUNT(*) FROM assessments) as total_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'submitted') as submitted_assessments,
        (SELECT ROUND(AVG(total_score)::numeric, 2) FROM assessments WHERE status = 'submitted') as average_score,
        (SELECT ROUND(AVG(maturity_level)::numeric, 2) FROM assessments WHERE status = 'submitted') as average_maturity
    `);

    const bySector = await this.db.query<SectorStatRow>(`
      SELECT e.sector,
             COUNT(DISTINCT e.id) as entity_count,
             COUNT(a.id) FILTER (WHERE a.status = 'submitted') as completed,
             ROUND(AVG(a.maturity_level) FILTER (WHERE a.status = 'submitted')::numeric, 2) as avg_maturity
      FROM entities e
      LEFT JOIN assessments a ON a.entity_id = e.id
      WHERE e.cr_number != 'SYSTEM-000001'
      GROUP BY e.sector
      ORDER BY entity_count DESC
    `);

    const row = result.rows[0];
    return {
      totalEntities: Number(row.total_entities),
      totalUsers: Number(row.total_users),
      totalAssessments: Number(row.total_assessments),
      submittedAssessments: Number(row.submitted_assessments),
      averageScore: row.average_score ? Number(row.average_score) : null,
      averageMaturity: row.average_maturity ? Number(row.average_maturity) : null,
      bySector: bySector.rows.map((s) => ({
        sector: s.sector,
        entityCount: Number(s.entity_count),
        completed: Number(s.completed),
        averageMaturity: s.avg_maturity ? Number(s.avg_maturity) : null,
      })),
    };
  }

  // --- Question bank management (Section 9) ---

  async listQuestions() {
    const result = await this.db.query<QuestionBankRow>(`
      SELECT qb.id, qb.domain_id, d.name_en AS domain_name_en, qb.text_ar, qb.text_en,
             qb.help_text_ar, qb.help_text_en, qb.materiality_topic_id, qb.base_weight,
             qb.calculator_type, qb.active
      FROM question_bank qb
      JOIN domains d ON d.id = qb.domain_id
      ORDER BY d.display_order ASC, qb.id ASC
    `);
    return result.rows.map((q) => ({
      id: q.id,
      domainId: q.domain_id,
      domainNameEn: q.domain_name_en,
      textAr: q.text_ar,
      textEn: q.text_en,
      helpTextAr: q.help_text_ar,
      helpTextEn: q.help_text_en,
      materialityTopicId: q.materiality_topic_id,
      baseWeight: Number(q.base_weight),
      calculatorType: q.calculator_type,
      active: q.active,
    }));
  }

  async updateQuestion(id: string, dto: Record<string, unknown>) {
    const map: Array<[string, string]> = [
      ['textAr', 'text_ar'],
      ['textEn', 'text_en'],
      ['helpTextAr', 'help_text_ar'],
      ['helpTextEn', 'help_text_en'],
      ['baseWeight', 'base_weight'],
      ['active', 'active'],
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, col] of map) {
      if (dto[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(dto[key]);
      }
    }
    if (fields.length === 0) throw new NotFoundException('Nothing to update');
    values.push(id);
    const res = await this.db.query(
      `UPDATE question_bank SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`,
      values,
    );
    if (res.rowCount === 0) throw new NotFoundException('Question not found');
    return { id, updated: true };
  }

  // --- Recommendation library management ---

  async listRecommendations() {
    const result = await this.db.query<RecLibRow>(
      `SELECT * FROM recommendation_library ORDER BY domain_id ASC, id ASC`,
    );
    return result.rows.map((r) => this.mapRec(r));
  }

  async updateRecommendation(id: string, dto: Record<string, unknown>) {
    const map: Array<[string, string]> = [
      ['triggerMaxScore', 'trigger_max_score'],
      ['immediateActionAr', 'immediate_action_ar'],
      ['immediateActionEn', 'immediate_action_en'],
      ['shortTermActionAr', 'short_term_action_ar'],
      ['shortTermActionEn', 'short_term_action_en'],
      ['mediumTermActionAr', 'medium_term_action_ar'],
      ['mediumTermActionEn', 'medium_term_action_en'],
      ['costEstimate', 'cost_estimate'],
      ['effortLevel', 'effort_level'],
      ['scoreImpactPoints', 'score_impact_points'],
      ['timelineWeeks', 'timeline_weeks'],
      ['legalReference', 'legal_reference'],
      ['active', 'active'],
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, col] of map) {
      if (dto[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(dto[key]);
      }
    }
    if (fields.length === 0) throw new NotFoundException('Nothing to update');
    values.push(id);
    const res = await this.db.query<RecLibRow>(
      `UPDATE recommendation_library SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!res.rows[0]) throw new NotFoundException('Recommendation not found');
    return this.mapRec(res.rows[0]);
  }

  // --- Regulatory mapping viewer ---

  async listRegulatoryMappings() {
    const result = await this.db.query<RegMapRow>(`
      SELECT rm.id, rm.bank_question_id, qb.text_en AS question_text_en,
             rm.regulation, rm.clause, rm.authority, rm.url
      FROM regulatory_mappings rm
      LEFT JOIN question_bank qb ON qb.id = rm.bank_question_id
      ORDER BY rm.authority ASC, rm.bank_question_id ASC
    `);
    return result.rows.map((m) => ({
      id: m.id,
      bankQuestionId: m.bank_question_id,
      questionTextEn: m.question_text_en,
      regulation: m.regulation,
      clause: m.clause,
      authority: m.authority,
      url: m.url,
    }));
  }

  private mapRec(r: RecLibRow) {
    return {
      id: r.id,
      materialityTopicId: r.materiality_topic_id,
      domainId: r.domain_id,
      triggerMaxScore: r.trigger_max_score,
      immediateActionAr: r.immediate_action_ar,
      immediateActionEn: r.immediate_action_en,
      shortTermActionAr: r.short_term_action_ar,
      shortTermActionEn: r.short_term_action_en,
      mediumTermActionAr: r.medium_term_action_ar,
      mediumTermActionEn: r.medium_term_action_en,
      costEstimate: r.cost_estimate,
      effortLevel: r.effort_level,
      scoreImpactPoints: r.score_impact_points,
      timelineWeeks: r.timeline_weeks,
      legalReference: r.legal_reference,
      active: r.active,
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
    const a = await this.db.query<{
      entity_id: string;
      status: string;
      total_score: string | null;
      maturity_level: number | null;
      domain_scores: Record<string, number> | null;
      submitted_at: Date | string | null;
    }>(
      `SELECT entity_id, status, total_score, maturity_level, domain_scores, submitted_at
       FROM assessments WHERE id = $1`,
      [assessmentId],
    );
    if (!a.rows[0]) throw new NotFoundException('Assessment not found');
    const row = a.rows[0];
    if (row.status !== 'submitted') {
      throw new NotFoundException('Report only available for submitted assessments');
    }

    const domainScores = row.domain_scores ?? {};
    const domainRows = await this.db.query<{ id: string; name_ar: string; display_order: number }>(
      'SELECT id, name_ar, display_order FROM domains WHERE active = TRUE ORDER BY display_order ASC',
    );
    const domains = domainRows.rows
      .filter((d) => domainScores[d.id] !== undefined)
      .map((d) => {
        const score = domainScores[d.id] ?? 0;
        return { nameAr: d.name_ar, score, maturity: score <= 0 ? 1 : Math.min(5, Math.ceil(score / 20)) };
      });

    const entity = await this.db.query<{
      name_ar: string;
      sector: string;
      entity_type: string | null;
      environmental_exposure: string | null;
      employee_count_bracket: string | null;
    }>(
      'SELECT name_ar, sector, entity_type, environmental_exposure, employee_count_bracket FROM entities WHERE id = $1',
      [row.entity_id],
    );
    const e = entity.rows[0];
    const recommendations = await this.recommendationEngine.build(assessmentId);

    return buildReportData(
      e?.name_ar ?? '',
      {
        totalScore: row.total_score ? Number(row.total_score) : 0,
        maturityLevel: row.maturity_level ?? 1,
        submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
        domains,
        profile: {
          sector: e?.sector ?? null,
          entityType: e?.entity_type ?? null,
          environmentalExposure: e?.environmental_exposure ?? null,
          employeeCountBracket: e?.employee_count_bracket ?? null,
        },
      },
      recommendations,
    );
  }

  private toIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }
}
