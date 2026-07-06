import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

/**
 * Loads the client's official SEMS v0.4 engine content (converted to JSON by
 * tools/convert-sems-xlsx.py) into the database, making it the active engine.
 *
 *   npm run import:sems         (dev, ts-node)
 *   npm run import:sems:prod    (built)
 *
 * Idempotent: every row is an upsert keyed by its natural id, so re-running
 * reflects spreadsheet updates without duplicating. The old D1–D6 draft content
 * is deactivated (active=false), not deleted, so it stays recoverable.
 */

const SEED_DIR = path.join(__dirname, 'seed', 'sems-v04');

function load<T = any>(name: string): T {
  const p = path.join(SEED_DIR, name);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function loadOptional<T = any>(name: string): T | null {
  const p = path.join(SEED_DIR, name);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as T) : null;
}

// Spreadsheet sentinels that mean "no value".
const SENTINELS = new Set(['', 'n/a', 'na', 'none', '-', 'null']);
function nn(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return SENTINELS.has(s.toLowerCase()) ? null : s;
}
function yn(v: unknown): boolean {
  const s = nn(v);
  return s !== null && ['yes', 'true', '1'].includes(s.toLowerCase());
}

function createPool(): Pool {
  const ssl =
    process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
  // Managed/serverless Postgres (Neon…) provides a single connection string.
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
  return new Pool({
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'env_project',
    ssl,
  });
}

interface Translation {
  textEn?: string | null;
  purposeEn?: string | null;
  optionsEn?: string[] | null;
  // Guidance English is a later translation pass; null until then.
  guidanceEn?: string | null;
}

async function importDomains(pool: Pool, domains: any[]) {
  for (const d of domains) {
    await pool.query(
      `INSERT INTO domains (id, name_ar, name_en, display_order, active)
       VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (id) DO UPDATE
         SET name_ar = EXCLUDED.name_ar,
             name_en = EXCLUDED.name_en,
             display_order = EXCLUDED.display_order,
             active = TRUE`,
      [d.id, d.nameAr, d.nameEn, d.displayOrder],
    );
  }
  return domains.length;
}

async function importQuestions(
  pool: Pool,
  questions: any[],
  translations: Record<string, Translation> | null,
) {
  for (const q of questions) {
    const t = translations?.[q.id] ?? {};
    // Merge machine translations into the answer options (keeps order/length).
    const options = (q.answerOptions ?? []).map((o: any, i: number) => ({
      ...o,
      labelEn: t.optionsEn?.[i] ?? null,
    }));
    const enStatus =
      t.textEn || t.purposeEn ? 'machine' : 'pending';

    await pool.query(
      `INSERT INTO question_bank (
        id, domain_id, text_ar, text_en, help_text_ar, help_text_en,
        materiality_topic_id, base_weight, calculator_type, applicability, active,
        spec_version, status, category, layer, measurement_layer, sub_domain,
        assessment_element, purpose_ar, purpose_en, typology, answer_type,
        answer_options, answer_options_raw, applicability_rule_id,
        applicability_trigger, applicability_priority, scoring_treatment,
        red_flag_logic, recommendation_id, min_evidence_level, maturity_rubric_id,
        outcome_threshold_id, attribution_required, attribution_method,
        baseline_required, trend_required, evidence_freshness_rule,
        evidence_conflict_rule, benchmark_readiness_criteria, benchmarking_method,
        guidance_ar, guidance_en, basic_guidance_ar, advanced_guidance_ar,
        completion_effort, data_availability, user_difficulty, estimated_time,
        rule_engine_id, kg_node_id, retirement_status, dependency_parents,
        dependency_children, en_review_status, raw
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,
        $11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,
        $22,$23,$24,
        $25,$26,$27,
        $28,$29,$30,$31,
        $32,$33,$34,
        $35,$36,$37,
        $38,$39,$40,
        $41,$42,$43,$44,
        $45,$46,$47,$48,
        $49,$50,$51,$52,
        $53,$54,$55
      )
      ON CONFLICT (id) DO UPDATE SET
        domain_id = EXCLUDED.domain_id,
        text_ar = EXCLUDED.text_ar,
        text_en = EXCLUDED.text_en,
        active = TRUE,
        spec_version = EXCLUDED.spec_version,
        status = EXCLUDED.status,
        category = EXCLUDED.category,
        layer = EXCLUDED.layer,
        measurement_layer = EXCLUDED.measurement_layer,
        sub_domain = EXCLUDED.sub_domain,
        assessment_element = EXCLUDED.assessment_element,
        purpose_ar = EXCLUDED.purpose_ar,
        purpose_en = EXCLUDED.purpose_en,
        typology = EXCLUDED.typology,
        answer_type = EXCLUDED.answer_type,
        answer_options = EXCLUDED.answer_options,
        answer_options_raw = EXCLUDED.answer_options_raw,
        applicability_rule_id = EXCLUDED.applicability_rule_id,
        applicability_trigger = EXCLUDED.applicability_trigger,
        applicability_priority = EXCLUDED.applicability_priority,
        scoring_treatment = EXCLUDED.scoring_treatment,
        red_flag_logic = EXCLUDED.red_flag_logic,
        recommendation_id = EXCLUDED.recommendation_id,
        min_evidence_level = EXCLUDED.min_evidence_level,
        maturity_rubric_id = EXCLUDED.maturity_rubric_id,
        outcome_threshold_id = EXCLUDED.outcome_threshold_id,
        attribution_required = EXCLUDED.attribution_required,
        attribution_method = EXCLUDED.attribution_method,
        baseline_required = EXCLUDED.baseline_required,
        trend_required = EXCLUDED.trend_required,
        evidence_freshness_rule = EXCLUDED.evidence_freshness_rule,
        evidence_conflict_rule = EXCLUDED.evidence_conflict_rule,
        benchmark_readiness_criteria = EXCLUDED.benchmark_readiness_criteria,
        benchmarking_method = EXCLUDED.benchmarking_method,
        guidance_ar = EXCLUDED.guidance_ar,
        guidance_en = EXCLUDED.guidance_en,
        basic_guidance_ar = EXCLUDED.basic_guidance_ar,
        advanced_guidance_ar = EXCLUDED.advanced_guidance_ar,
        completion_effort = EXCLUDED.completion_effort,
        data_availability = EXCLUDED.data_availability,
        user_difficulty = EXCLUDED.user_difficulty,
        estimated_time = EXCLUDED.estimated_time,
        rule_engine_id = EXCLUDED.rule_engine_id,
        kg_node_id = EXCLUDED.kg_node_id,
        retirement_status = EXCLUDED.retirement_status,
        dependency_parents = EXCLUDED.dependency_parents,
        dependency_children = EXCLUDED.dependency_children,
        en_review_status = EXCLUDED.en_review_status,
        raw = EXCLUDED.raw`,
      [
        q.id, q.domainId, q.textAr, t.textEn ?? null, nn(q.guidanceAr), t.guidanceEn ?? null,
        null, 1.0, null, JSON.stringify({}),
        nn(q.version) ?? 'v0.4', nn(q.status), nn(q.category), nn(q.layer), nn(q.measurementLayer), nn(q.subDomain),
        nn(q.assessmentElement), nn(q.purposeAr), t.purposeEn ?? null, nn(q.typology), nn(q.answerType),
        JSON.stringify(options), nn(q.answerOptionsRaw), nn(q.applicabilityRuleId),
        nn(q.applicabilityTrigger), nn(q.applicabilityPriority), nn(q.scoringTreatment),
        nn(q.redFlagLogic), nn(q.recommendationId), nn(q.minEvidenceLevel), nn(q.maturityRubricId),
        nn(q.outcomeThresholdId), yn(q.attributionRequired), nn(q.attributionMethod),
        yn(q.baselineRequired), yn(q.trendRequired), nn(q.evidenceFreshnessRule),
        nn(q.evidenceConflictRule), nn(q.benchmarkReadinessCriteria), nn(q.benchmarkingMethod),
        nn(q.guidanceAr), t.guidanceEn ?? null, nn(q.basicGuidanceAr), nn(q.advancedGuidanceAr),
        nn(q.completionEffort), nn(q.dataAvailability), nn(q.userDifficulty), nn(q.estimatedTime),
        nn(q.ruleEngineId), nn(q.kgNodeId), nn(q.retirementStatus), nn(q.dependencyParents),
        nn(q.dependencyChildren), enStatus, JSON.stringify(q.raw ?? {}),
      ],
    );
  }
  return questions.length;
}

async function upsertReference(
  pool: Pool,
  table: string,
  idCol: string,
  rows: any[],
  map: (r: any) => Record<string, any>,
) {
  for (const r of rows) {
    const fields = map(r);
    const cols = Object.keys(fields);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const updates = cols
      .filter((c) => c !== idCol)
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');
    await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (${idCol}) DO UPDATE SET ${updates}`,
      cols.map((c) => fields[c]),
    );
  }
  return rows.length;
}

async function main() {
  // Ensure DB + schema exist (also seeds the legacy draft on a fresh DB, which
  // we then deactivate below).
  const svc = new DatabaseService();
  await svc.migrate();

  const pool = createPool();
  const report: Record<string, number> = {};
  try {
    const domains = load<any[]>('domains.json');
    const questions = load<any[]>('questions.json');
    const translations = loadOptional<Record<string, Translation>>(
      'translations.json',
    );

    report.domains = await importDomains(pool, domains);
    report.questions = await importQuestions(pool, questions, translations);

    // Deactivate legacy draft (non-v0.4 questions + non-v0.4 domains).
    const v04Ids = questions.map((q) => q.id);
    const v04Domains = domains.map((d) => d.id);
    await pool.query(
      `UPDATE question_bank SET active = FALSE WHERE id <> ALL($1)`,
      [v04Ids],
    );
    await pool.query(`UPDATE domains SET active = FALSE WHERE id <> ALL($1)`, [
      v04Domains,
    ]);

    report.rule_engine_rules = await upsertReference(
      pool, 'rule_engine_rules', 'id', load('rule-engine.json'), (r) => ({
        id: r.Rule_ID,
        rule_type: nn(r.Rule_Type),
        priority: nn(r.Priority),
        status: nn(r.Status),
        data: JSON.stringify(r),
      }),
    );
    report.decision_dictionary = await upsertReference(
      pool, 'decision_dictionary', 'id', load('decision-dictionary.json'), (r) => ({
        id: r.Term_ID,
        term: nn(r.Term),
        data: JSON.stringify(r),
      }),
    );
    report.conflict_decision_tree = await upsertReference(
      pool, 'conflict_decision_tree', 'step', load('conflict-tree.json'), (r) => ({
        step: Number(r.Step),
        data: JSON.stringify(r),
      }),
    );
    report.maturity_rubrics = await upsertReference(
      pool, 'maturity_rubrics', 'id', load('maturity-rubrics.json'), (r) => ({
        id: r.Rubric_ID,
        applies_to: nn(r.Applies_To),
        data: JSON.stringify(r),
      }),
    );
    report.attribution_categories = await upsertReference(
      pool, 'attribution_categories', 'id', load('attribution.json'), (r) => ({
        id: r.Attribution_ID,
        category: nn(r.Attribution_Category),
        data: JSON.stringify(r),
      }),
    );
    report.outcome_thresholds = await upsertReference(
      pool, 'outcome_thresholds', 'id', load('outcome-thresholds.json'), (r) => ({
        id: r.Threshold_ID,
        impact_area: nn(r.Impact_Area),
        data: JSON.stringify(r),
      }),
    );
    report.evidence_rules = await upsertReference(
      pool, 'evidence_rules', 'id', load('evidence-rules.json'), (r) => ({
        id: r.Rule_ID,
        evidence_type: nn(r.Evidence_Type),
        data: JSON.stringify(r),
      }),
    );
    report.benchmark_readiness_criteria = await upsertReference(
      pool, 'benchmark_readiness_criteria', 'id', load('benchmark-readiness.json'), (r) => ({
        id: r.Readiness_ID,
        criterion: nn(r.Criterion),
        data: JSON.stringify(r),
      }),
    );
    report.question_dependencies = await upsertReference(
      pool, 'question_dependencies', 'id', load('dependencies.json'), (r) => ({
        id: r.Dependency_ID,
        parent_question: nn(r.Parent_Question),
        child_question: nn(r.Child_Question_or_Module),
        dependency_type: nn(r.Dependency_Type),
        priority: nn(r.Priority),
        data: JSON.stringify(r),
      }),
    );
    report.knowledge_graph_edges = await upsertReference(
      pool, 'knowledge_graph_edges', 'id', load('kg-edges.json'), (r) => ({
        id: r.Edge_ID,
        from_node: nn(r.From_Node),
        relation: nn(r.Relation),
        to_node: nn(r.To_Node),
        source_question: nn(r.Source_Question),
        data: JSON.stringify(r),
      }),
    );
    report.source_lineage = await upsertReference(
      pool, 'source_lineage', 'id', load('source-lineage.json'), (r) => ({
        id: r.Source_ID,
        source_name: nn(r.Source_Name),
        data: JSON.stringify(r),
      }),
    );

    // eslint-disable-next-line no-console
    console.log('SEMS v0.4 import complete:', JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('SEMS v0.4 import failed:', err);
    process.exit(1);
  });
