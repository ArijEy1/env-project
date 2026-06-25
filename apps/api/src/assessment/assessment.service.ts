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
import { ANSWER_OPTIONS, TOTAL_QUESTIONS } from './questions';
import { computeEngineScore } from './engine-scoring';
import {
  QuestionGenerationService,
  type AssessmentProfile,
} from './question-generation.service';
import {
  RecommendationEngineService,
  type EngineRecommendation,
} from './recommendation-engine.service';
import { buildReportData } from './pdf-report';

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
  scoring_config_id: string | null;
  domain_scores: Record<string, number> | null;
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
    private readonly recommendationEngine: RecommendationEngineService,
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
      const snapshotCount = await this.db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM assessment_questions WHERE assessment_id = $1',
        [row.id],
      );
      const totalQuestions = Number(snapshotCount.rows[0].count) || TOTAL_QUESTIONS;
      assessments.push({
        id: row.id,
        entityId: row.entity_id,
        userId: row.user_id,
        status: row.status,
        currentQuestionIndex: row.current_question_index,
        createdAt: this.toIso(row.created_at),
        submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
        answeredCount: Number(countResult.rows[0].count),
        totalQuestions,
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
      domainScores: row.domain_scores ?? null,
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

    // Validate the question belongs to this assessment's frozen snapshot.
    const snapshotQuestion = await this.db.query<{ id: string }>(
      'SELECT id FROM assessment_questions WHERE assessment_id = $1 AND bank_question_id = $2',
      [assessmentId, dto.questionId],
    );
    if (!snapshotQuestion.rows[0]) {
      throw new BadRequestException(
        `Question "${dto.questionId}" is not part of this assessment`,
      );
    }

    await this.db.query(
      `INSERT INTO assessment_answers (id, assessment_id, question_id, score, assessment_question_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (assessment_id, question_id)
       DO UPDATE SET score = $4, assessment_question_id = $5, updated_at = NOW()`,
      [uuidv4(), assessmentId, dto.questionId, dto.score, snapshotQuestion.rows[0].id],
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

    // Score against the frozen snapshot (Phase D).
    const snapshot = await this.db.query<{
      bank_question_id: string;
      domain_id: string;
      effective_weight: string;
    }>(
      'SELECT bank_question_id, domain_id, effective_weight FROM assessment_questions WHERE assessment_id = $1',
      [assessmentId],
    );
    const snapshotCount = snapshot.rows.length;
    if (snapshotCount === 0) {
      throw new BadRequestException(
        'This assessment has no generated questions. Please start a new assessment.',
      );
    }

    const countResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );
    const answeredCount = Number(countResult.rows[0].count);
    if (answeredCount < snapshotCount) {
      throw new BadRequestException(
        `All ${snapshotCount} questions must be answered before submitting. Currently answered: ${answeredCount}`,
      );
    }

    const answersResult = await this.db.query<AnswerRow>(
      'SELECT question_id, score FROM assessment_answers WHERE assessment_id = $1',
      [assessmentId],
    );
    const answerMap = new Map(
      answersResult.rows.map((a) => [a.question_id, a.score]),
    );

    const questions = snapshot.rows.map((q) => ({
      questionId: q.bank_question_id,
      domainId: q.domain_id,
      effectiveWeight: Number(q.effective_weight),
    }));

    const domainWeights = await this.loadDomainWeights(row.scoring_config_id);
    const result = computeEngineScore(
      questions,
      answerMap,
      domainWeights,
      row.scoring_config_id,
      new Date().toISOString(),
    );

    await this.db.query(
      `UPDATE assessments
       SET status = 'submitted', submitted_at = NOW(),
           total_score = $1, maturity_level = $2, domain_scores = $3,
           calculation_audit = $4, governance_score = $5, compliance_score = $6
       WHERE id = $7`,
      [
        result.totalScore,
        result.maturityLevel,
        JSON.stringify(result.domainScores),
        JSON.stringify(result.calculationAudit),
        // Legacy columns kept populated (= D1/D2) for the current results page + PDF
        // until the Phase F dashboard.
        result.domainScores['D1'] ?? null,
        result.domainScores['D2'] ?? null,
        assessmentId,
      ],
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

    // Reuse the results computation (domains + profile + totals) and the
    // recommendation engine, then shape it for the Arabic PDF.
    const entity = await this.findEntityById(entityId);
    const results = await this.getResults(assessmentId, userId);
    const recommendations = await this.recommendationEngine.build(assessmentId);

    return buildReportData(entity?.name_ar ?? '', results, recommendations);
  }

  async getRecommendations(
    assessmentId: string,
    userId: string,
  ): Promise<EngineRecommendation[]> {
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

    return this.recommendationEngine.build(assessmentId);
  }

  /**
   * Rich results payload for the Section 7 dashboard: per-domain scores +
   * maturity + top gap, the profile used, and overall score/maturity. Domain
   * names come from the DB so they track the (swappable) content.
   */
  async getResults(assessmentId: string, userId: string) {
    const entityId = await this.getEntityId(userId);
    const row = await this.findAssessment(assessmentId);

    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    if (row.entity_id !== entityId) {
      throw new ForbiddenException('You do not have access to this assessment');
    }
    if (row.status !== 'submitted') {
      throw new BadRequestException('Results are only available for submitted assessments');
    }

    const domainScores = row.domain_scores ?? {};

    const domainRows = await this.db.query<{
      id: string;
      name_ar: string;
      name_en: string;
      display_order: number;
    }>(
      'SELECT id, name_ar, name_en, display_order FROM domains WHERE active = TRUE ORDER BY display_order ASC',
    );

    // Top gap per domain = lowest-scoring question (tie broken by highest weight).
    const gapRows = await this.db.query<{
      domain_id: string;
      text_ar: string;
      text_en: string;
      effective_weight: string;
      score: number;
    }>(
      `SELECT aq.domain_id, aq.text_ar, aq.text_en, aq.effective_weight,
              COALESCE(aa.score, 0) AS score
       FROM assessment_questions aq
       LEFT JOIN assessment_answers aa
         ON aa.assessment_id = aq.assessment_id
        AND aa.question_id = aq.bank_question_id
       WHERE aq.assessment_id = $1`,
      [assessmentId],
    );
    const topGap = new Map<string, { text_ar: string; text_en: string; score: number; weight: number }>();
    for (const g of gapRows.rows) {
      const weight = Number(g.effective_weight);
      const cur = topGap.get(g.domain_id);
      if (!cur || g.score < cur.score || (g.score === cur.score && weight > cur.weight)) {
        topGap.set(g.domain_id, { text_ar: g.text_ar, text_en: g.text_en, score: g.score, weight });
      }
    }

    const profile = await this.db.query<{
      sector: string;
      entity_type: string | null;
      environmental_exposure: string | null;
      employee_count_bracket: string | null;
    }>(
      'SELECT sector, entity_type, environmental_exposure, employee_count_bracket FROM entities WHERE id = $1',
      [entityId],
    );

    const domains = domainRows.rows
      .filter((d) => domainScores[d.id] !== undefined)
      .map((d) => {
        const score = domainScores[d.id] ?? 0;
        const gap = topGap.get(d.id);
        return {
          id: d.id,
          nameAr: d.name_ar,
          nameEn: d.name_en,
          score,
          maturity: score <= 0 ? 1 : Math.min(5, Math.ceil(score / 20)),
          topGapAr: gap?.text_ar ?? null,
          topGapEn: gap?.text_en ?? null,
        };
      });

    return {
      assessmentId,
      totalScore: row.total_score ? Number(row.total_score) : 0,
      maturityLevel: row.maturity_level ?? 1,
      submittedAt: row.submitted_at ? this.toIso(row.submitted_at) : null,
      domains,
      profile: {
        sector: profile.rows[0]?.sector ?? null,
        entityType: profile.rows[0]?.entity_type ?? null,
        environmentalExposure: profile.rows[0]?.environmental_exposure ?? null,
        employeeCountBracket: profile.rows[0]?.employee_count_bracket ?? null,
      },
    };
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
      `SELECT id, entity_id, user_id, status, current_question_index, total_score,
              governance_score, compliance_score, maturity_level, scoring_config_id,
              domain_scores, created_at, submitted_at
       FROM assessments WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  private async loadDomainWeights(
    scoringConfigId: string | null,
  ): Promise<Record<string, number>> {
    const result = scoringConfigId
      ? await this.db.query<{ domain_weights: Record<string, number> }>(
          'SELECT domain_weights FROM scoring_configurations WHERE id = $1',
          [scoringConfigId],
        )
      : await this.db.query<{ domain_weights: Record<string, number> }>(
          'SELECT domain_weights FROM scoring_configurations WHERE active = TRUE ORDER BY version DESC LIMIT 1',
        );
    return result.rows[0]?.domain_weights ?? {};
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

    const loadSnapshot = () =>
      this.db.query<{
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

    let questions = await loadSnapshot();

    // Heal legacy drafts created before Phase C: generate the snapshot lazily.
    if (questions.rows.length === 0 && row.status === 'draft') {
      const profile = await this.getEntityProfile(userId);
      await this.questionGeneration.generateSnapshot(assessmentId, {
        sector: profile.sector,
        entityType: profile.entityType,
        size: profile.employeeCountBracket,
        exposure: profile.environmentalExposure,
      });
      const scoringConfigId = await this.questionGeneration.getActiveScoringConfigId();
      await this.db.query(
        'UPDATE assessments SET scoring_config_id = COALESCE(scoring_config_id, $1) WHERE id = $2',
        [scoringConfigId, assessmentId],
      );
      questions = await loadSnapshot();
    }

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
      answerOptions: ANSWER_OPTIONS,
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
