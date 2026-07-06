import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  computeActiveSet,
  determineDepth,
  type Depth,
  type RoutingAnswers,
  type RoutingQuestion,
} from './engine/routing';
import type { Canonical } from './engine/answer-types';

export interface AssessmentProfile {
  sector: string;
  entityType: string | null;
  size: string | null; // employee bracket
  exposure: string | null;
}

interface BankRow {
  id: string;
  domain_id: string;
  category: string | null;
  text_ar: string;
  text_en: string | null;
  help_text_ar: string | null;
  help_text_en: string | null;
  guidance_ar: string | null;
  guidance_en: string | null;
  purpose_ar: string | null;
  purpose_en: string | null;
  answer_type: string | null;
  answer_options: unknown;
  scoring_treatment: string | null;
  applicability_rule_id: string | null;
  applicability_trigger: string | null;
  min_evidence_level: string | null;
  maturity_rubric_id: string | null;
  outcome_threshold_id: string | null;
  attribution_required: boolean;
  trend_required: boolean;
  red_flag_logic: string | null;
  base_weight: string;
  domain_order: number;
}

@Injectable()
export class QuestionGenerationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Freezes the FULL v0.4 question set into the assessment snapshot. Every
   * active bank question is copied with the fields needed to serve + score it,
   * and an `active` flag: initially only always-on questions (Profile,
   * Applicability, Core) are active; conditional/advanced ones switch on as the
   * routing answers come in (see recomputeRouting).
   */
  async generateSnapshot(
    assessmentId: string,
    profile: AssessmentProfile,
  ): Promise<{ total: number; active: number; depth: Depth }> {
    const bank = await this.loadActiveBank();
    const depth = determineDepth({
      size: profile.size,
      exposure: profile.exposure,
      listed: profile.entityType === 'listed',
    });

    const routingQs: RoutingQuestion[] = bank.map((q) => ({
      id: q.id,
      category: q.category,
      applicabilityRuleId: q.applicability_rule_id,
      applicabilityTrigger: q.applicability_trigger,
    }));
    // No answers yet — only trigger='All' questions come back active.
    const active = computeActiveSet(routingQs, new Map(), depth);

    let order = 0;
    for (const q of bank) {
      const isRouting = q.category === 'Profile' || q.category === 'Applicability';
      await this.db.query(
        `INSERT INTO assessment_questions (
          id, assessment_id, bank_question_id, domain_id, materiality_topic_id,
          effective_weight, display_order, text_ar, text_en, help_text_ar, help_text_en,
          calculator_type, category, answer_type, answer_options, scoring_treatment,
          applicability_rule_id, applicability_trigger, min_evidence_level,
          maturity_rubric_id, outcome_threshold_id, attribution_required, trend_required,
          red_flag_logic, guidance_ar, guidance_en, purpose_ar, purpose_en, active, is_routing
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
        )
        ON CONFLICT (assessment_id, bank_question_id) DO NOTHING`,
        [
          uuidv4(), assessmentId, q.id, q.domain_id, null,
          Number(q.base_weight) || 1, order++, q.text_ar, q.text_en ?? q.text_ar,
          q.help_text_ar, q.help_text_en, null, q.category, q.answer_type,
          JSON.stringify(q.answer_options ?? []), q.scoring_treatment,
          q.applicability_rule_id, q.applicability_trigger, q.min_evidence_level,
          q.maturity_rubric_id, q.outcome_threshold_id, q.attribution_required,
          q.trend_required, q.red_flag_logic, q.guidance_ar, q.guidance_en,
          q.purpose_ar, q.purpose_en, active.has(q.id), isRouting,
        ],
      );
    }

    return { total: bank.length, active: active.size, depth };
  }

  /**
   * Re-evaluates conditional routing after a Profile/Applicability answer
   * changes: recomputes the active set from the current routing answers and the
   * profile-derived depth, and flips the `active` flags in the snapshot.
   */
  async recomputeRouting(
    assessmentId: string,
    profile: AssessmentProfile,
  ): Promise<{ active: number }> {
    const snapshot = await this.db.query<{
      bank_question_id: string;
      category: string | null;
      applicability_rule_id: string | null;
      applicability_trigger: string | null;
    }>(
      `SELECT bank_question_id, category, applicability_rule_id, applicability_trigger
       FROM assessment_questions WHERE assessment_id = $1`,
      [assessmentId],
    );

    const answers = await this.loadRoutingAnswers(assessmentId);
    const depth = determineDepth({
      size: profile.size,
      exposure: profile.exposure,
      listed: profile.entityType === 'listed' || answers.get('PRF-010') === 'yes',
    });

    const routingQs: RoutingQuestion[] = snapshot.rows.map((q) => ({
      id: q.bank_question_id,
      category: q.category,
      applicabilityRuleId: q.applicability_rule_id,
      applicabilityTrigger: q.applicability_trigger,
    }));
    const active = computeActiveSet(routingQs, answers, depth);

    await this.db.query(
      `UPDATE assessment_questions
       SET active = (bank_question_id = ANY($2))
       WHERE assessment_id = $1`,
      [assessmentId, [...active]],
    );

    return { active: active.size };
  }

  /** Canonical answers to the routing (PRF/APP) questions for this assessment. */
  private async loadRoutingAnswers(assessmentId: string): Promise<RoutingAnswers> {
    const rows = await this.db.query<{ question_id: string; canonical: string | null }>(
      `SELECT question_id, raw_answer->>'canonical' AS canonical
       FROM assessment_answers WHERE assessment_id = $1`,
      [assessmentId],
    );
    const map: RoutingAnswers = new Map();
    for (const r of rows.rows) map.set(r.question_id, (r.canonical as Canonical) ?? null);
    return map;
  }

  async getActiveScoringConfigId(): Promise<string | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM scoring_configurations WHERE active = TRUE ORDER BY version DESC LIMIT 1`,
    );
    return r.rows[0]?.id ?? null;
  }

  private async loadActiveBank(): Promise<BankRow[]> {
    const r = await this.db.query<BankRow>(
      `SELECT qb.id, qb.domain_id, qb.category, qb.text_ar, qb.text_en,
              qb.help_text_ar, qb.help_text_en, qb.guidance_ar, qb.guidance_en,
              qb.purpose_ar, qb.purpose_en, qb.answer_type, qb.answer_options,
              qb.scoring_treatment, qb.applicability_rule_id, qb.applicability_trigger,
              qb.min_evidence_level, qb.maturity_rubric_id, qb.outcome_threshold_id,
              qb.attribution_required, qb.trend_required, qb.red_flag_logic,
              qb.base_weight, d.display_order AS domain_order
       FROM question_bank qb
       JOIN domains d ON d.id = qb.domain_id
       WHERE qb.active = TRUE AND d.active = TRUE
       ORDER BY d.display_order ASC, qb.id ASC`,
    );
    return r.rows;
  }
}
