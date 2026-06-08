import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Client, Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly databaseName = process.env.POSTGRES_DB ?? 'env_project';
  private readonly adminDatabaseName =
    process.env.POSTGRES_ADMIN_DB ?? 'postgres';
  private pool!: Pool;

  async onModuleInit() {
    await this.ensureDatabaseExists();
    this.pool = this.createPool(this.databaseName);
    await this.ensureEntitiesTable();
    await this.ensureUsersTable();
    await this.ensurePasswordResetTokensTable();
    await this.ensureAssessmentsTable();
    await this.ensureAssessmentAnswersTable();
    this.logger.log(`PostgreSQL ready on database "${this.databaseName}"`);
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

  private createPool(database: string) {
    return new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database,
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  private async ensureDatabaseExists() {
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

    await adminClient.connect();

    try {
      const existingDatabase = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.databaseName],
      );

      if (existingDatabase.rowCount === 0) {
        await adminClient.query(`CREATE DATABASE ${safeDatabaseName}`);
        this.logger.log(`Created PostgreSQL database "${this.databaseName}"`);
      }
    } finally {
      await adminClient.end();
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

    // Add score columns if they don't exist (for existing tables)
    const columns = await this.pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'total_score'",
    );
    if (columns.rows.length === 0) {
      await this.pool.query('ALTER TABLE assessments ADD COLUMN total_score DECIMAL(5,2)');
      await this.pool.query('ALTER TABLE assessments ADD COLUMN governance_score DECIMAL(5,2)');
      await this.pool.query('ALTER TABLE assessments ADD COLUMN compliance_score DECIMAL(5,2)');
      await this.pool.query('ALTER TABLE assessments ADD COLUMN maturity_level INT');
    }

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

  private escapeIdentifier(identifier: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }
}