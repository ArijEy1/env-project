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
    await this.ensureUsersTable();
    await this.ensurePasswordResetTokensTable();
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

  private async ensureUsersTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        phone VARCHAR(50),
        country_code VARCHAR(10),
        entity VARCHAR(120),
        job_role VARCHAR(120),
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

  private escapeIdentifier(identifier: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }
}