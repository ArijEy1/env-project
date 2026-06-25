import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { getQuestionById, TOTAL_QUESTIONS } from './questions';
import { calculateScore } from './scoring';
import { generateRecommendations, type Recommendation } from './recommendations';
import {
  QuestionGenerationService,
  type AssessmentProfile,
} from './question-generation.service';

interface AssessmentRow {
  id: string;
  entity_id: string;
  user_id: string;
  status: string;
  current_question_index: number;
  total_score: string | null;       // DECIMAL comes as string from pg
  governance_score: string | null;
  compliance_score: string | null;
  maturity_level: number | null;
  created_at: Date | string;
  submitted_at: Date | string | null;
}

interface AnswerRow {
  id: string;
  assessment_id: string;
  question_id: string;
  score: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface UserEntityRow {
  entity_id: string;
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly questionGeneration: QuestionGenerationService,
  ) {}

  async create(userId: string) {
    const profile = await this.getEntityProfile(userId);
    const entityId = profile.entityId;

    const existing = await this.db.query<AssessmentRow>(
      "SELECT id FROM assessments WHERE entity_id = $1 AND status = 'draft' LIMIT 1",
      [entityId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('A draft assessment already exists for your organization');
    }

    const id = uuidv4();
    await this.db.query(
      `INSERT INTO assessments (id, entity_id, user_id, status, current_question_index)
       VALUES ($1, $2, $3, 'draft', 0)`,
      [id, entityId, userId],
    );

    // Phase C: generate + freeze the personalised question snapshot for the
    // exact profile, and record the profile + scoring config used.
    const assessmentProfile: AssessmentProfile = {
      sector: profile.sector,
      entityType: profile.entityType,
      size: profile.employeeCountBracket,
      exposure: profile.environmentalExposure,
    };
    const generated = await this.questionGeneration.generateSnapshot(
      id,
      assessmentProfile,
    );
    const scoringConfigId = await this.questionGeneration.getActiveScoringConfigId();
    await this.db.query(
      `UPDATE assessments
       SET profile_snapshot = $1, scoring_config_id = $2
       WHERE id = $3`,
      [
        JSON.stringify({
          ...assessmentProfile,
          questionCount: generated.length,
          scoringConfigId,
        }),
        scoringConfigId,
        id,
      ],
    );

    // Lock the organization profile once the first assessment starts (Section 2).
    await this.db.query(
      `UPDATE entities SET profile_locked_at = NOW()
       WHERE id = $1 AND profile_locked_at IS NULL`,
      [entityId],
    );

    return this.getById(id, userId);
  }

  async list(userId: string) {
    const entityId = await this.getEntityId(userId);

    const result = await this.db.query<AssessmentRow>(
      `SELECT id, entity_id, user_id, status, current_question_index, total_score, governance_score, compliance_score, maturity_level, created_at, submitted_at
       FROM assessments WHERE entity_id = $1 ORDER BY created_at DESC`,
      [entityId],
    );

    const assessments = [];
    for (const row of result.rows) {
      const countResult = await this.db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM assessment_answers WHERE assessment_id = $1',
        [row.id],
      );
      assessments.push({
        id: row.id,
        entityId: row.entity_id,
        userId: row.user_id,
        status: row.status,
        currentQuestionIndex: row.current_question_index,
        createdAt: this.toIso(row.created_at),
        submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
        answeredCount: Number(countResult.rows[0].count),
        totalQuestions: TOTAL_QUESTIONS,
        totalScore: row.total_score ? Number(row.total_score) : null,
        governanceScore: row.governance_score ? Number(row.governance_score) : null,
        complianceScore: row.compliance_score ? Number(row.compliance_score) : null,
        maturityLevel: row.maturity_level ?? null,
      });
    }

    return assessments;
  }

  async getById(assessmentId: string, userId: string) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }

    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }

    const answers = await this.db.query<AnswerRow>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    return {
      id: row.id,
      entityId: row.entity_id,
      userId: row.user_id,
      status: row.status,
      currentQuestionIndex: row.current_question_index,
      createdAt: this.toIso(row.created_at),
      submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
      totalScore: row.total_score ? Number(row.total_score) : null,
      governanceScore: row.governance_score ? Number(row.governance_score) : null,
      complianceScore: row.compliance_score ? Number(row.compliance_score) : null,
      maturityLevel: row.maturity_level ?? null,
      answers: answers.rows.map((a) => ({
        questionId: a.question_id,
        score: a.score,
      })),
    };
  }

  async saveAnswer(assessmentId: string, userId: string, dto: SaveAnswerDto) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('Cannot modify a submitted assessment');
    }

    const question = getQuestionById(dto.questionId);
    if (!question) {
      throw new BadRequestException(`Invalid question ID: ${dto.questionId}`);
    }

    await this.db.query(
      `INSERT INTO assessment_answers (id, assessment_id, question_id, score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assessment_id, question_id)
       DO UPDATE SET score = $4, updated_at = NOW()`,
      [uuidv4(), assessmentId, dto.questionId, dto.score],
    );

    return { questionId: dto.questionId, score: dto.score };
  }

  async updateProgress(assessmentId: string, userId: string, dto: UpdateProgressDto) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('Cannot modify a submitted assessment');
    }

    await this.db.query(
      'UPDATE assessments SET current_question_index = $1 WHERE id = $2',
      [dto.currentQuestionIndex, assessmentId],
    );

    return { currentQuestionIndex: dto.currentQuestionIndex };
  }

  async submit(assessmentId: string, userId: string) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('Assessment is already submitted');
    }

    const countResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    const answeredCount = Number(countResult.rows[0].count);
    if (answeredCount < TOTAL_QUESTIONS) {
      throw new BadRequestException(
        `All ${TOTAL_QUESTIONS} questions must be answered before submitting. Currently answered: ${answeredCount}`,
      );
    }

    // Fetch all answers for scoring
    const answersResult = await this.db.query<AnswerRow>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    const scoreResult = calculateScore(
      answersResult.rows.map((a) => ({ questionId: a.question_id, score: a.score })),
    );

    await this.db.query(
      `UPDATE assessments
       SET status = 'submitted', submitted_at = NOW(),
           total_score = $1, governance_score = $2, compliance_score = $3, maturity_level = $4
       WHERE id = $5`,
      [scoreResult.totalScore, scoreResult.governanceScore, scoreResult.complianceScore, scoreResult.maturityLevel, assessmentId],
    );

    return this.getById(assessmentId, userId);
  }

  async getReportData(assessmentId: string, userId: string) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'submitted') {
      throw new BadRequestException('Report is only available for submitted assessments');
    }

    const entity = await this.findEntityById(entityId);
    const answers = await this.db.query<{ question_id: string; score: number }>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    const recommendations = generateRecommendations(
      answers.rows.map((a) => ({ questionId: a.question_id, score: a.score })),
    );

    return {
      entityNameAr: entity?.name_ar ?? '',
      entityNameEn: entity?.name_en ?? null,
      submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : new Date().toISOString(),
      totalScore: row.total_score ? Number(row.total_score) : 0,
      governanceScore: row.governance_score ? Number(row.governance_score) : 0,
      complianceScore: row.compliance_score ? Number(row.compliance_score) : 0,
      maturityLevel: row.maturity_level ?? 1,
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

  async getRecommendations(assessmentId: string, userId: string): Promise<Recommendation[]> {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'submitted') {
      throw new BadRequestException('Recommendations are only available for submitted assessments');
    }

    const answers = await this.db.query<{ question_id: string; score: number }>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );

    return generateRecommendations(
      answers.rows.map((a) => ({ questionId: a.question_id, score: a.score })),
    );
  }

  private async findEntityById(entityId: string) {
    const result = await this.db.query<{ name_ar: string; name_en: string | null }>(
      'SELECT name_ar, name_en FROM entities WHERE id = $1',
      [entityId],
    );
    return result.rows[0] ?? null;
  }

  private async findAssessment(id: string) {
    const result = await this.db.query<AssessmentRow>(
      `SELECT id, entity_id, user_id, status, current_question_index, total_score, governance_score, compliance_score, maturity_level, created_at, submitted_at
       FROM assessments WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  private async getEntityId(userId: string): Promise<string> {
    const result = await this.db.query<UserEntityRow>(
      'SELECT entity_id FROM users WHERE id = $1',
      [userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('User not found');
    }
    return result.rows[0].entity_id;
  }

  private async getEntityProfile(userId: string): Promise<{
    entityId: string;
    sector: string;
    entityType: string | null;
    environmentalExposure: string | null;
    employeeCountBracket: string | null;
  }> {
    const result = await this.db.query<{
      entity_id: string;
      sector: string;
      entity_type: string | null;
      environmental_exposure: string | null;
      employee_count_bracket: string | null;
    }>(
      `SELECT e.id AS entity_id, e.sector, e.entity_type,
              e.environmental_exposure, e.employee_count_bracket
       FROM users u JOIN entities e ON e.id = u.entity_id
       WHERE u.id = $1`,
      [userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('User not found');
    }
    const r = result.rows[0];
    return {
      entityId: r.entity_id,
      sector: r.sector,
      entityType: r.entity_type,
      environmentalExposure: r.environmental_exposure,
      employeeCountBracket: r.employee_count_bracket,
    };
  }

  /**
   * Returns the frozen, personalised question set for an assessment (Phase C),
   * grouped-ready with the domains used. Read-only; reflects the snapshot taken
   * at create time, not the current bank.
   */
  async getGeneratedQuestions(assessmentId: string, userId: string) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);
    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }

    const questions = await this.db.query<{
      bank_question_id: string;
      domain_id: string;
      materiality_topic_id: string | null;
      effective_weight: string;
      display_order: number;
      text_ar: string;
      text_en: string;
      help_text_ar: string | null;
      help_text_en: string | null;
      calculator_type: string | null;
    }>(
      `SELECT bank_question_id, domain_id, materiality_topic_id, effective_weight,
              display_order, text_ar, text_en, help_text_ar, help_text_en, calculator_type
       FROM assessment_questions WHERE assessment_id = $1 ORDER BY display_order ASC`,
      [assessmentId],
    );

    const usedDomainIds = new Set(questions.rows.map((q) => q.domain_id));
    const domains = await this.db.query<{
      id: string;
      name_ar: string;
      name_en: string;
      display_order: number;
    }>(
      `SELECT id, name_ar, name_en, display_order FROM domains
       WHERE active = TRUE ORDER BY display_order ASC`,
    );

    const profileSnapshot = await this.db.query<{ profile_snapshot: unknown }>(
      'SELECT profile_snapshot FROM assessments WHERE id = $1',
      [assessmentId],
    );

    return {
      assessmentId,
      profileSnapshot: profileSnapshot.rows[0]?.profile_snapshot ?? null,
      totalQuestions: questions.rows.length,
      domains: domains.rows
        .filter((d) => usedDomainIds.has(d.id))
        .map((d) => ({ id: d.id, nameAr: d.name_ar, nameEn: d.name_en })),
      questions: questions.rows.map((q) => ({
        questionId: q.bank_question_id,
        domainId: q.domain_id,
        materialityTopicId: q.materiality_topic_id,
        effectiveWeight: Number(q.effective_weight),
        displayOrder: q.display_order,
        textAr: q.text_ar,
        textEn: q.text_en,
        helpTextAr: q.help_text_ar,
        helpTextEn: q.help_text_en,
        calculatorType: q.calculator_type,
      })),
    };
  }

  private toIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }
}
