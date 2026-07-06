import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Client, Pool, QueryResult, QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  DRAFT_DOMAINS,
  DRAFT_GLOSSARY,
  DRAFT_MATERIALITY_TOPICS,
  DRAFT_MATERIALITY_WEIGHTS,
  DRAFT_QUESTION_BANK,
  DRAFT_RECOMMENDATIONS,
  DRAFT_REGULATORY_MAPPINGS,
  DRAFT_SCORING_CONFIG,
} from './seed/draft-content';

// Arbitrary fixed key so all instances contend on the same advisory lock.
const MIGRATION_LOCK_KEY = 472948572;

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly databaseName = process.env.POSTGRES_DB ?? 'env_project';
  private readonly adminDatabaseName =
    process.env.POSTGRES_ADMIN_DB ?? 'postgres';
  private pool!: Pool;

  async onModuleInit() {
    // Whether to apply schema/seed when the app boots. Default: yes in dev for
    // convenience, NO in production (run `npm run migrate` as a deploy step).
    // Either way it's safe — runMigrations() holds an advisory lock so concurrent
    // instances serialize, and all DDL is idempotent.
    const migrateOnBoot =
      process.env.MIGRATE_ON_BOOT !== undefined
        ? process.env.MIGRATE_ON_BOOT === 'true'
        : process.env.NODE_ENV !== 'production';

    if (migrateOnBoot) {
      await this.ensureDatabaseExists();
    }
    this.pool = this.createPool(this.databaseName);

    if (migrateOnBoot) {
      await this.runMigrations();
      this.logger.log(`PostgreSQL ready on database "${this.databaseName}"`);
    } else {
      await this.pool.query('SELECT 1'); // verify connectivity, fail fast
      this.logger.log(
        `PostgreSQL connected to "${this.databaseName}" (migrations not run on boot; run "npm run migrate")`,
      );
    }
  }

  /** Standalone entrypoint used by the `migrate` CLI script. */
  async migrate() {
    await this.ensureDatabaseExists();
    this.pool = this.createPool(this.databaseName);
    await this.runMigrations();
    await this.pool.end();
  }

  /**
   * Applies all schema + seed under a Postgres advisory lock so that multiple
   * instances starting together (or a deploy migrate step + a booting app) can
   * never race on DDL. All statements are idempotent (CREATE/ADD … IF NOT EXISTS,
   * seed-if-empty), so a second runner is a no-op.
   */
  private async runMigrations() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

      await this.ensureEntitiesTable();
      await this.ensureUsersTable();
      await this.ensurePasswordResetTokensTable();
      await this.ensurePendingRegistrationsTable();
      await this.ensureAssessmentsTable();
      await this.ensureAssessmentAnswersTable();

      // --- Assessment engine ---
      await this.ensureEntityProfileColumns();
      await this.ensureDomainsTable();
      await this.ensureMaterialityTopicsTable();
      await this.ensureQuestionBankTable();
      await this.ensureMaterialityWeightsTable();
      await this.ensureScoringConfigurationsTable();
      await this.ensureRecommendationLibraryTable();
      await this.ensureRegulatoryMappingsTable();
      await this.ensureGlossaryTermsTable();
      await this.ensureAssessmentEngineColumns();
      await this.ensureAssessmentQuestionsTable();
      await this.ensureAssessmentAnswerEngineColumns();

      // --- SEMS v0.4 engine (Phase 1: schema only; content loaded by the
      //     import-sems-v04 script, not by boot seeding). ---
      await this.ensureSemsV04QuestionColumns();
      await this.ensureSemsV04ReferenceTables();
      await this.ensureSemsV04AnswerColumns();
      await this.ensureSemsV04AssessmentColumns();

      await this.seedDraftContent();
    } finally {
      await client
        .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
        .catch(() => undefined);
      client.release();
    }
  }

  async onApplicationShutdown() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  private get sslConfig() {
    return process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined;
  }

  private createPool(database: string) {
    // Managed/serverless Postgres (Neon, Supabase, Railway…) hands you a single
    // connection string — prefer it when present; the `database` is baked into it.
    if (process.env.DATABASE_URL) {
      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: this.sslConfig,
      });
    }
    return new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database,
      ssl: this.sslConfig,
    });
  }

  private async ensureDatabaseExists() {
    // Managed Postgres (Neon/RDS/Cloud SQL/Azure) pre-creates the DB and the app
    // role usually can't CREATE DATABASE or reach the admin DB. Skip explicitly
    // via SKIP_DB_CREATE=true or when a DATABASE_URL is supplied, and treat any
    // failure as "DB already exists".
    if (process.env.SKIP_DB_CREATE === 'true' || process.env.DATABASE_URL) {
      return;
    }

    const safeDatabaseName = this.escapeIdentifier(this.databaseName);
    const adminClient = new Client({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: this.adminDatabaseName,
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
    });

    try {
      await adminClient.connect();
      const existingDatabase = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.databaseName],
      );

      if (existingDatabase.rowCount === 0) {
        await adminClient.query(`CREATE DATABASE ${safeDatabaseName}`);
        this.logger.log(`Created PostgreSQL database "${this.databaseName}"`);
      }
    } catch (e) {
      this.logger.warn(
        `Skipping database auto-create (${String(e)}); assuming "${this.databaseName}" already exists.`,
      );
    } finally {
      await adminClient.end().catch(() => undefined);
    }
  }

  private async ensureEntitiesTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY,
        name_ar VARCHAR(255) NOT NULL,
        name_en VARCHAR(255),
        cr_number VARCHAR(50) NOT NULL UNIQUE,
        sector VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        region VARCHAR(100),
        employee_count_bracket VARCHAR(50),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        unified_national_number VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async ensureUsersTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        phone VARCHAR(50),
        job_role VARCHAR(120),
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email)',
    );
  }

  private async ensurePasswordResetTokensTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at)',
    );
  }

  private async ensurePendingRegistrationsTable() {
    // Holds not-yet-verified sign-ups until the emailed OTP is confirmed. The
    // full sign-up payload (with an already-bcrypt-hashed password) lives here;
    // the real entity/user rows are only created on successful verification.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id UUID PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        otp_hash TEXT NOT NULL,
        payload JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS pending_registrations_expires_at_idx ON pending_registrations (expires_at)',
    );
  }

  private async ensureAssessmentsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id UUID PRIMARY KEY,
        entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        current_question_index INT NOT NULL DEFAULT 0,
        total_score DECIMAL(5,2),
        governance_score DECIMAL(5,2),
        compliance_score DECIMAL(5,2),
        maturity_level INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMPTZ
      )
    `);

    // Score columns for older tables — idempotent (no TOCTOU on concurrent runs).
    await this.pool.query('ALTER TABLE assessments ADD COLUMN IF NOT EXISTS total_score DECIMAL(5,2)');
    await this.pool.query('ALTER TABLE assessments ADD COLUMN IF NOT EXISTS governance_score DECIMAL(5,2)');
    await this.pool.query('ALTER TABLE assessments ADD COLUMN IF NOT EXISTS compliance_score DECIMAL(5,2)');
    await this.pool.query('ALTER TABLE assessments ADD COLUMN IF NOT EXISTS maturity_level INT');

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessments_entity_id_idx ON assessments (entity_id)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessments_status_idx ON assessments (status)',
    );
  }

  private async ensureAssessmentAnswersTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_answers (
        id UUID PRIMARY KEY,
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        question_id VARCHAR(20) NOT NULL,
        score INT NOT NULL CHECK (score IN (0, 25, 50, 75, 100)),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(assessment_id, question_id)
      )
    `);

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessment_answers_assessment_id_idx ON assessment_answers (assessment_id)',
    );
  }

  // --- Assessment engine schema (Phase A) ---

  private async ensureEntityProfileColumns() {
    await this.pool.query(
      `ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_type VARCHAR(40)`,
    );
    await this.pool.query(
      `ALTER TABLE entities ADD COLUMN IF NOT EXISTS environmental_exposure VARCHAR(10)`,
    );
    await this.pool.query(
      `ALTER TABLE entities ADD COLUMN IF NOT EXISTS submitted_exposure VARCHAR(10)`,
    );
    await this.pool.query(
      `ALTER TABLE entities ADD COLUMN IF NOT EXISTS profile_locked_at TIMESTAMPTZ`,
    );
  }

  private async ensureDomainsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS domains (
        id VARCHAR(10) PRIMARY KEY,
        name_ar VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
  }

  private async ensureMaterialityTopicsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS materiality_topics (
        id VARCHAR(60) PRIMARY KEY,
        name_ar VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        domain_id VARCHAR(10) NOT NULL REFERENCES domains(id),
        active BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
  }

  private async ensureQuestionBankTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id VARCHAR(40) PRIMARY KEY,
        domain_id VARCHAR(10) NOT NULL REFERENCES domains(id),
        text_ar TEXT NOT NULL,
        text_en TEXT NOT NULL,
        help_text_ar TEXT,
        help_text_en TEXT,
        materiality_topic_id VARCHAR(60) REFERENCES materiality_topics(id),
        base_weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
        calculator_type VARCHAR(40),
        applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS question_bank_domain_id_idx ON question_bank (domain_id)',
    );
  }

  private async ensureMaterialityWeightsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS materiality_weights (
        id UUID PRIMARY KEY,
        dimension VARCHAR(20) NOT NULL,
        dimension_value VARCHAR(60) NOT NULL,
        materiality_topic_id VARCHAR(60) NOT NULL REFERENCES materiality_topics(id),
        multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0,
        version INT NOT NULL DEFAULT 1,
        UNIQUE (dimension, dimension_value, materiality_topic_id, version)
      )
    `);
  }

  private async ensureScoringConfigurationsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS scoring_configurations (
        id VARCHAR(60) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain_weights JSONB NOT NULL,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async ensureRecommendationLibraryTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS recommendation_library (
        id VARCHAR(60) PRIMARY KEY,
        materiality_topic_id VARCHAR(60) REFERENCES materiality_topics(id),
        domain_id VARCHAR(10) NOT NULL REFERENCES domains(id),
        trigger_max_score INT NOT NULL DEFAULT 50,
        immediate_action_ar TEXT NOT NULL,
        immediate_action_en TEXT NOT NULL,
        short_term_action_ar TEXT NOT NULL,
        short_term_action_en TEXT NOT NULL,
        medium_term_action_ar TEXT NOT NULL,
        medium_term_action_en TEXT NOT NULL,
        cost_estimate VARCHAR(120),
        effort_level VARCHAR(10) NOT NULL DEFAULT 'medium',
        score_impact_points INT NOT NULL DEFAULT 0,
        timeline_weeks INT NOT NULL DEFAULT 0,
        legal_reference VARCHAR(255),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1
      )
    `);
  }

  private async ensureRegulatoryMappingsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS regulatory_mappings (
        id UUID PRIMARY KEY,
        bank_question_id VARCHAR(40) NOT NULL REFERENCES question_bank(id),
        regulation VARCHAR(255) NOT NULL,
        clause VARCHAR(255),
        authority VARCHAR(60),
        url TEXT
      )
    `);
  }

  private async ensureGlossaryTermsTable() {
    // Section 8: the approved terminology glossary (50+ Academy-standardised
    // terms). Managed via the admin backoffice; seeded with a few placeholders.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS glossary_terms (
        id UUID PRIMARY KEY,
        term_ar VARCHAR(255) NOT NULL,
        term_en VARCHAR(255),
        definition_ar TEXT NOT NULL,
        definition_en TEXT,
        category VARCHAR(80),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async ensureAssessmentEngineColumns() {
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS profile_snapshot JSONB`,
    );
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS scoring_config_id VARCHAR(60)`,
    );
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS domain_scores JSONB`,
    );
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS calculation_audit JSONB`,
    );
    // Report-download counter (Section 9 platform statistics).
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS download_count INT NOT NULL DEFAULT 0`,
    );
    // Draft retention + reminder tracking (Section 4).
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    );
    await this.pool.query(
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`,
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessments_last_activity_idx ON assessments (last_activity_at)',
    );
  }

  private async ensureAssessmentQuestionsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_questions (
        id UUID PRIMARY KEY,
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        bank_question_id VARCHAR(40) NOT NULL,
        domain_id VARCHAR(10) NOT NULL,
        materiality_topic_id VARCHAR(60),
        effective_weight NUMERIC(6,3) NOT NULL DEFAULT 1.0,
        display_order INT NOT NULL DEFAULT 0,
        text_ar TEXT NOT NULL,
        text_en TEXT NOT NULL,
        help_text_ar TEXT,
        help_text_en TEXT,
        calculator_type VARCHAR(40),
        UNIQUE (assessment_id, bank_question_id)
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessment_questions_assessment_id_idx ON assessment_questions (assessment_id)',
    );
  }

  private async ensureAssessmentAnswerEngineColumns() {
    await this.pool.query(
      `ALTER TABLE assessment_answers ADD COLUMN IF NOT EXISTS assessment_question_id UUID`,
    );
    await this.pool.query(
      `ALTER TABLE assessment_answers ADD COLUMN IF NOT EXISTS calculator_inputs JSONB`,
    );
  }

  // --- SEMS v0.4 engine schema (Phase 1) ---------------------------------
  // The client's official v0.4 question bank is a full decision-grade engine
  // spec (168 questions, rule engine, rubrics, thresholds, dependencies…).
  // These migrations extend the existing tables and add the reference tables
  // the engine needs. Content is loaded by `npm run import:sems` — NOT seeded
  // on boot — so it stays reproducible from the client's spreadsheet.
  //
  // All statements are idempotent (ADD COLUMN / CREATE TABLE IF NOT EXISTS).

  private async ensureSemsV04QuestionColumns() {
    // v0.4 questions are Arabic-only; English is machine-translated on import
    // and flagged for review, so text_en can no longer be NOT NULL.
    await this.pool.query(
      `ALTER TABLE question_bank ALTER COLUMN text_en DROP NOT NULL`,
    );

    const cols: Array<[string, string]> = [
      ['spec_version', 'VARCHAR(20)'], // e.g. "v0.4" (distinct from numeric version)
      ['status', 'TEXT'],
      ['category', 'VARCHAR(30)'], // Core | Conditional | Advanced | Profile | Applicability
      ['layer', 'VARCHAR(30)'],
      ['measurement_layer', 'VARCHAR(30)'],
      ['sub_domain', 'VARCHAR(255)'],
      ['assessment_element', 'VARCHAR(255)'],
      ['purpose_ar', 'TEXT'],
      ['purpose_en', 'TEXT'],
      ['typology', 'VARCHAR(80)'],
      ['answer_type', 'VARCHAR(60)'],
      ['answer_options', "JSONB NOT NULL DEFAULT '[]'::jsonb"],
      ['answer_options_raw', 'TEXT'],
      ['applicability_rule_id', 'VARCHAR(60)'],
      ['applicability_trigger', 'VARCHAR(120)'],
      ['applicability_priority', 'VARCHAR(10)'],
      ['scoring_treatment', 'VARCHAR(80)'],
      ['red_flag_logic', 'TEXT'],
      ['recommendation_id', 'VARCHAR(60)'],
      ['min_evidence_level', 'VARCHAR(10)'],
      ['maturity_rubric_id', 'VARCHAR(60)'],
      ['outcome_threshold_id', 'VARCHAR(60)'],
      ['attribution_required', 'BOOLEAN NOT NULL DEFAULT FALSE'],
      ['attribution_method', 'VARCHAR(120)'],
      ['baseline_required', 'BOOLEAN NOT NULL DEFAULT FALSE'],
      ['trend_required', 'BOOLEAN NOT NULL DEFAULT FALSE'],
      ['evidence_freshness_rule', 'TEXT'],
      ['evidence_conflict_rule', 'TEXT'],
      ['benchmark_readiness_criteria', 'TEXT'],
      ['benchmarking_method', 'TEXT'],
      ['guidance_ar', 'TEXT'],
      ['guidance_en', 'TEXT'],
      ['basic_guidance_ar', 'TEXT'],
      ['basic_guidance_en', 'TEXT'],
      ['advanced_guidance_ar', 'TEXT'],
      ['advanced_guidance_en', 'TEXT'],
      ['completion_effort', 'VARCHAR(20)'],
      ['data_availability', 'VARCHAR(40)'],
      ['user_difficulty', 'VARCHAR(20)'],
      ['estimated_time', 'VARCHAR(40)'],
      ['rule_engine_id', 'VARCHAR(60)'],
      ['kg_node_id', 'VARCHAR(80)'],
      ['retirement_status', 'VARCHAR(40)'],
      ['dependency_parents', 'TEXT'],
      ['dependency_children', 'TEXT'],
      // Machine-translation review state for the English fields.
      ['en_review_status', "VARCHAR(20) NOT NULL DEFAULT 'pending'"],
      // Full verbatim spreadsheet row for traceability / audit.
      ['raw', 'JSONB'],
    ];
    for (const [name, type] of cols) {
      await this.pool.query(
        `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS ${name} ${type}`,
      );
    }

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS question_bank_category_idx ON question_bank (category)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS question_bank_scoring_treatment_idx ON question_bank (scoring_treatment)',
    );
  }

  private async ensureSemsV04ReferenceTables() {
    // Each table carries its natural key + the few fields the engine queries by,
    // plus a `data` JSONB holding the full record so nothing from the spec is lost.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rule_engine_rules (
        id VARCHAR(60) PRIMARY KEY,
        rule_type VARCHAR(60),
        priority VARCHAR(10),
        status VARCHAR(40),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS decision_dictionary (
        id VARCHAR(60) PRIMARY KEY,
        term VARCHAR(255),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS conflict_decision_tree (
        step INT PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS maturity_rubrics (
        id VARCHAR(60) PRIMARY KEY,
        applies_to VARCHAR(255),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS attribution_categories (
        id VARCHAR(60) PRIMARY KEY,
        category VARCHAR(120),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS outcome_thresholds (
        id VARCHAR(60) PRIMARY KEY,
        impact_area VARCHAR(120),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS evidence_rules (
        id VARCHAR(60) PRIMARY KEY,
        evidence_type VARCHAR(255),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS benchmark_readiness_criteria (
        id VARCHAR(60) PRIMARY KEY,
        criterion VARCHAR(255),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS question_dependencies (
        id VARCHAR(80) PRIMARY KEY,
        parent_question VARCHAR(40),
        child_question VARCHAR(60),
        dependency_type VARCHAR(60),
        priority VARCHAR(10),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS question_dependencies_parent_idx ON question_dependencies (parent_question)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS question_dependencies_child_idx ON question_dependencies (child_question)',
    );
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
        id VARCHAR(120) PRIMARY KEY,
        from_node VARCHAR(255),
        relation VARCHAR(80),
        to_node VARCHAR(255),
        source_question VARCHAR(40),
        data JSONB NOT NULL
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS kg_edges_source_question_idx ON knowledge_graph_edges (source_question)',
    );
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS source_lineage (
        id VARCHAR(60) PRIMARY KEY,
        source_name VARCHAR(255),
        data JSONB NOT NULL
      )
    `);
  }

  private async ensureSemsV04AnswerColumns() {
    // The v0.4 answer model is richer than the fixed 0/25/50/75/100 scale:
    // answers carry a raw value (option / number / trend) plus a server-derived
    // normalized score, confidence, evidence level and red-flag state. The old
    // `score` CHECK constraint would reject the new normalized values, so drop it.
    await this.pool.query(
      `ALTER TABLE assessment_answers DROP CONSTRAINT IF EXISTS assessment_answers_score_check`,
    );
    const cols: Array<[string, string]> = [
      ['answer_type', 'VARCHAR(60)'],
      ['raw_answer', 'JSONB'],
      ['normalized_score', 'NUMERIC(6,2)'], // 0-100, nullable (no-score questions)
      ['confidence', 'NUMERIC(5,2)'],
      ['evidence_level', 'VARCHAR(10)'],
      ['red_flag', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ];
    for (const [name, type] of cols) {
      await this.pool.query(
        `ALTER TABLE assessment_answers ADD COLUMN IF NOT EXISTS ${name} ${type}`,
      );
    }
  }

  private async ensureSemsV04AssessmentColumns() {
    // The frozen per-assessment question snapshot needs the v0.4 fields required
    // to serve + score each question, plus an `active` flag toggled by routing.
    const qCols: Array<[string, string]> = [
      ['category', 'VARCHAR(30)'],
      ['answer_type', 'VARCHAR(60)'],
      ['answer_options', "JSONB NOT NULL DEFAULT '[]'::jsonb"],
      ['scoring_treatment', 'VARCHAR(80)'],
      ['applicability_rule_id', 'VARCHAR(60)'],
      ['applicability_trigger', 'VARCHAR(120)'],
      ['min_evidence_level', 'VARCHAR(10)'],
      ['maturity_rubric_id', 'VARCHAR(60)'],
      ['outcome_threshold_id', 'VARCHAR(60)'],
      ['attribution_required', 'BOOLEAN NOT NULL DEFAULT FALSE'],
      ['trend_required', 'BOOLEAN NOT NULL DEFAULT FALSE'],
      ['red_flag_logic', 'TEXT'],
      ['guidance_ar', 'TEXT'],
      ['guidance_en', 'TEXT'],
      ['purpose_ar', 'TEXT'],
      ['purpose_en', 'TEXT'],
      // Conditional routing: a question is served/scored only while active.
      ['active', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      // Profile/Applicability questions drive routing.
      ['is_routing', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ];
    for (const [name, type] of qCols) {
      await this.pool.query(
        `ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS ${name} ${type}`,
      );
    }
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS assessment_questions_active_idx ON assessment_questions (assessment_id, active)',
    );

    // Assessment-level v0.4 results: confidence, gate outcome, red flags.
    const aCols: Array<[string, string]> = [
      ['raw_total_score', 'NUMERIC(6,2)'],
      ['confidence_score', 'NUMERIC(5,2)'],
      ['gate_status', 'VARCHAR(10)'],
      ['gate_reasons', 'JSONB'],
      ['red_flags', 'JSONB'],
    ];
    for (const [name, type] of aCols) {
      await this.pool.query(
        `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS ${name} ${type}`,
      );
    }
  }

  /**
   * Seeds the DRAFT engine content table-by-table, but only when a table is
   * empty — so re-runs are no-ops and admin edits are never overwritten. Swap
   * the draft for the client's official content via the admin backoffice.
   */
  private async seedDraftContent() {
    const isEmpty = async (table: string) => {
      const r = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      return Number(r.rows[0].count) === 0;
    };

    if (await isEmpty('domains')) {
      for (const d of DRAFT_DOMAINS) {
        await this.pool.query(
          `INSERT INTO domains (id, name_ar, name_en, display_order)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [d.id, d.nameAr, d.nameEn, d.displayOrder],
        );
      }
    }

    if (await isEmpty('materiality_topics')) {
      for (const t of DRAFT_MATERIALITY_TOPICS) {
        await this.pool.query(
          `INSERT INTO materiality_topics (id, name_ar, name_en, domain_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [t.id, t.nameAr, t.nameEn, t.domainId],
        );
      }
    }

    if (await isEmpty('question_bank')) {
      for (const q of DRAFT_QUESTION_BANK) {
        await this.pool.query(
          `INSERT INTO question_bank (
            id, domain_id, text_ar, text_en, help_text_ar, help_text_en,
            materiality_topic_id, base_weight, calculator_type, applicability
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
          [
            q.id, q.domainId, q.textAr, q.textEn, q.helpTextAr, q.helpTextEn,
            q.materialityTopicId, q.baseWeight, q.calculatorType,
            JSON.stringify(q.applicability ?? {}),
          ],
        );
      }
    }

    if (await isEmpty('materiality_weights')) {
      for (const w of DRAFT_MATERIALITY_WEIGHTS) {
        await this.pool.query(
          `INSERT INTO materiality_weights (id, dimension, dimension_value, materiality_topic_id, multiplier)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (dimension, dimension_value, materiality_topic_id, version) DO NOTHING`,
          [uuidv4(), w.dimension, w.dimensionValue, w.materialityTopicId, w.multiplier],
        );
      }
    }

    if (await isEmpty('scoring_configurations')) {
      await this.pool.query(
        `INSERT INTO scoring_configurations (id, name, domain_weights, active)
         VALUES ($1, $2, $3, TRUE) ON CONFLICT (id) DO NOTHING`,
        [
          DRAFT_SCORING_CONFIG.id,
          DRAFT_SCORING_CONFIG.name,
          JSON.stringify(DRAFT_SCORING_CONFIG.domainWeights),
        ],
      );
    }

    if (await isEmpty('recommendation_library')) {
      for (const r of DRAFT_RECOMMENDATIONS) {
        await this.pool.query(
          `INSERT INTO recommendation_library (
            id, materiality_topic_id, domain_id, trigger_max_score,
            immediate_action_ar, immediate_action_en, short_term_action_ar, short_term_action_en,
            medium_term_action_ar, medium_term_action_en, cost_estimate, effort_level,
            score_impact_points, timeline_weeks, legal_reference
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (id) DO NOTHING`,
          [
            r.id, r.materialityTopicId, r.domainId, r.triggerMaxScore,
            r.immediateActionAr, r.immediateActionEn, r.shortTermActionAr, r.shortTermActionEn,
            r.mediumTermActionAr, r.mediumTermActionEn, r.costEstimate, r.effortLevel,
            r.scoreImpactPoints, r.timelineWeeks, r.legalReference,
          ],
        );
      }
    }

    if (await isEmpty('regulatory_mappings')) {
      for (const m of DRAFT_REGULATORY_MAPPINGS) {
        await this.pool.query(
          `INSERT INTO regulatory_mappings (id, bank_question_id, regulation, clause, authority, url)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuidv4(), m.bankQuestionId, m.regulation, m.clause, m.authority, m.url],
        );
      }
    }

    if (await isEmpty('glossary_terms')) {
      for (const g of DRAFT_GLOSSARY) {
        await this.pool.query(
          `INSERT INTO glossary_terms (id, term_ar, term_en, definition_ar, definition_en, category)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuidv4(), g.termAr, g.termEn, g.definitionAr, g.definitionEn, g.category],
        );
      }
    }

    this.logger.log('Draft engine content ensured (seeded where empty)');
  }

  private escapeIdentifier(identifier: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }
}