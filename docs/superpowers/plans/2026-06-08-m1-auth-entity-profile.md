# M1 — Authentication & Entity Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organization (entity) profiles, restructure registration to a two-step org+user flow, add brute-force protection, profile/entity update endpoints, and update the frontend to match.

**Architecture:** Entities are a new DB table with a 1:many relationship to users. Registration creates both in one transaction. Login rate limiting is in-memory. Frontend uses the existing `useLanguage()` hook for bilingual AR/EN RTL support.

**Tech Stack:** NestJS, PostgreSQL (via `pg`), Next.js 15, React 19, class-validator, JWT/Passport

**Spec:** `docs/superpowers/specs/2026-06-08-m1-auth-entity-profile-design.md`

---

## Task 1: Entity DB Table & Updated Users Table

**Files:**
- Modify: `apps/api/src/database/database.service.ts`

- [ ] **Step 1: Add `ensureEntitiesTable()` method**

Add this method to `DatabaseService` after the existing `ensurePasswordResetTokensTable()` method:

```typescript
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
```

- [ ] **Step 2: Update `ensureUsersTable()` to include new columns**

Replace the entire `ensureUsersTable()` method body. The new schema drops `entity` and `country_code`, adds `entity_id` and `role`:

```typescript
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
```

- [ ] **Step 3: Update `onModuleInit()` to call `ensureEntitiesTable` before `ensureUsersTable`**

Entities table must exist before users table (FK dependency). Replace the init body:

```typescript
async onModuleInit() {
  await this.ensureDatabaseExists();
  this.pool = this.createPool(this.databaseName);
  await this.ensureEntitiesTable();
  await this.ensureUsersTable();
  await this.ensurePasswordResetTokensTable();
  this.logger.log(`PostgreSQL ready on database "${this.databaseName}"`);
}
```

- [ ] **Step 4: Drop old tables so they get recreated with new schema**

Since this is dev with no production data, connect to the DB and drop the tables so they'll be recreated on next startup:

```bash
cd apps/api
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ host:'127.0.0.1', port:5433, user:'postgres', password:'postgres', database:'env_project' });
  await c.connect();
  await c.query('DROP TABLE IF EXISTS password_reset_tokens CASCADE');
  await c.query('DROP TABLE IF EXISTS users CASCADE');
  await c.query('DROP TABLE IF EXISTS entities CASCADE');
  console.log('Tables dropped');
  await c.end();
})();
"
```

- [ ] **Step 5: Verify the API restarts and creates tables**

Restart the API (it's running with `ts-node-dev --respawn` so saving the file triggers a restart). Check the console for:
```
Created PostgreSQL database "env_project"  (or just "PostgreSQL ready")
```

Then verify tables exist:
```bash
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ host:'127.0.0.1', port:5433, user:'postgres', password:'postgres', database:'env_project' });
  await c.connect();
  const r = await c.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\");
  console.log(r.rows.map(r => r.table_name));
  await c.end();
})();
"
```

Expected output: `['entities', 'password_reset_tokens', 'users']`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/database/database.service.ts
git commit -m "Add entities table and update users schema with entity_id and role"
```

---

## Task 2: Entity & User Type Definitions

**Files:**
- Create: `apps/api/src/auth/entities/entity.entity.ts`
- Modify: `apps/api/src/auth/entities/user.entity.ts`
- Modify: `apps/api/src/auth/interfaces/jwt-payload.interface.ts`

- [ ] **Step 1: Create entity interface**

Create `apps/api/src/auth/entities/entity.entity.ts`:

```typescript
export interface EntityRecord {
  id: string;
  nameAr: string;
  nameEn: string | null;
  crNumber: string;
  sector: string;
  city: string;
  region: string | null;
  employeeCountBracket: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  unifiedNationalNumber: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Update user entity**

Replace the entire contents of `apps/api/src/auth/entities/user.entity.ts`:

```typescript
import { EntityRecord } from './entity.entity';

export interface UserEntity {
  id: string;
  entityId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  password: string;
  phone: string | null;
  jobRole: string | null;
  role: string;
  createdAt: string;
}

export interface SafeUser extends Omit<UserEntity, 'password'> {
  entity: EntityRecord;
}
```

- [ ] **Step 3: Add role to JWT payload**

Replace the contents of `apps/api/src/auth/interfaces/jwt-payload.interface.ts`:

```typescript
export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/entities/entity.entity.ts apps/api/src/auth/entities/user.entity.ts apps/api/src/auth/interfaces/jwt-payload.interface.ts
git commit -m "Add entity type definitions and update user entity with role and entityId"
```

---

## Task 3: DTOs — Register, UpdateProfile, UpdateEntity

**Files:**
- Modify: `apps/api/src/auth/dto/register.dto.ts`
- Create: `apps/api/src/auth/dto/update-profile.dto.ts`
- Create: `apps/api/src/auth/dto/update-entity.dto.ts`

- [ ] **Step 1: Rewrite register DTO to nested entity+user structure**

Replace the entire contents of `apps/api/src/auth/dto/register.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SECTORS = [
  'industrial',
  'oil_and_gas',
  'manufacturing',
  'construction',
  'services',
  'government',
  'healthcare',
  'education',
  'other',
];

const EMPLOYEE_BRACKETS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

export class RegisterEntityDto {
  @IsString()
  @MinLength(2)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsString()
  @MinLength(5)
  crNumber!: string;

  @IsString()
  @IsIn(SECTORS)
  sector!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPLOYEE_BRACKETS)
  employeeCountBracket?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  unifiedNationalNumber?: string;
}

export class RegisterUserDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password!: string;
}

export class RegisterDto {
  @ValidateNested()
  @Type(() => RegisterEntityDto)
  entity!: RegisterEntityDto;

  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}
```

- [ ] **Step 2: Create update-profile DTO**

Create `apps/api/src/auth/dto/update-profile.dto.ts`:

```typescript
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;
}
```

- [ ] **Step 3: Create update-entity DTO**

Create `apps/api/src/auth/dto/update-entity.dto.ts`:

```typescript
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const SECTORS = [
  'industrial',
  'oil_and_gas',
  'manufacturing',
  'construction',
  'services',
  'government',
  'healthcare',
  'education',
  'other',
];

const EMPLOYEE_BRACKETS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

export class UpdateEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  @IsIn(SECTORS)
  sector?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPLOYEE_BRACKETS)
  employeeCountBracket?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  unifiedNationalNumber?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/dto/register.dto.ts apps/api/src/auth/dto/update-profile.dto.ts apps/api/src/auth/dto/update-entity.dto.ts
git commit -m "Restructure register DTO to nested entity+user and add update DTOs"
```

---

## Task 4: Login Rate Limiter

**Files:**
- Create: `apps/api/src/auth/login-rate-limiter.ts`

- [ ] **Step 1: Create the rate limiter class**

Create `apps/api/src/auth/login-rate-limiter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

interface AttemptRecord {
  failCount: number;
  lockedUntil: number | null;
}

@Injectable()
export class LoginRateLimiter {
  private readonly logger = new Logger(LoginRateLimiter.name);
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 5;
  private readonly lockoutMs = 15 * 60 * 1000;
  private readonly cleanupIntervalMs = 30 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  isLocked(email: string): boolean {
    const key = email.toLowerCase();
    const record = this.attempts.get(key);

    if (!record?.lockedUntil) {
      return false;
    }

    if (Date.now() >= record.lockedUntil) {
      this.attempts.delete(key);
      return false;
    }

    return true;
  }

  recordFailure(email: string): void {
    const key = email.toLowerCase();
    const record = this.attempts.get(key) ?? { failCount: 0, lockedUntil: null };

    record.failCount += 1;

    if (record.failCount >= this.maxAttempts) {
      record.lockedUntil = Date.now() + this.lockoutMs;
      this.logger.warn(`Login locked for ${key} after ${record.failCount} failed attempts`);
    }

    this.attempts.set(key, record);
  }

  recordSuccess(email: string): void {
    this.attempts.delete(email.toLowerCase());
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, record] of this.attempts) {
      if (record.lockedUntil && now >= record.lockedUntil) {
        this.attempts.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
```

- [ ] **Step 2: Register it in AuthModule**

In `apps/api/src/auth/auth.module.ts`, add the import and provider:

Add to imports at top:
```typescript
import { LoginRateLimiter } from './login-rate-limiter';
```

Add `LoginRateLimiter` to the `providers` array (after `JwtStrategy`):
```typescript
providers: [AuthService, AuthEmailService, JwtStrategy, LoginRateLimiter],
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/login-rate-limiter.ts apps/api/src/auth/auth.module.ts
git commit -m "Add in-memory login rate limiter with 5-attempt lockout"
```

---

## Task 5: Rewrite AuthService

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`

This is the largest change. The service needs to handle the new entity+user registration, entity joins on login/getProfile, rate limiting on login, and new updateProfile/updateEntity methods.

- [ ] **Step 1: Replace auth.service.ts**

Replace the entire contents of `apps/api/src/auth/auth.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AuthEmailService } from './auth-email.service';
import { jwtConstants } from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EntityRecord } from './entities/entity.entity';
import { SafeUser, UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginRateLimiter } from './login-rate-limiter';

interface UserRow {
  id: string;
  entity_id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  job_role: string | null;
  role: string;
  created_at: Date | string;
}

interface EntityRow {
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

interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordResetTtlMinutes = Number(
    process.env.PASSWORD_RESET_TTL_MINUTES ?? 60,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly authEmailService: AuthEmailService,
    private readonly loginRateLimiter: LoginRateLimiter,
  ) {}

  async register(registerDto: RegisterDto) {
    const entityDto = registerDto.entity;
    const userDto = registerDto.user;
    const normalizedEmail = userDto.email.toLowerCase().trim();

    const existingUser = await this.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const existingEntity = await this.findEntityByCrNumber(entityDto.crNumber.trim());
    if (existingEntity) {
      throw new BadRequestException('An organization with this CR number already exists');
    }

    const entityId = uuidv4();
    await this.databaseService.query(
      `INSERT INTO entities (
        id, name_ar, name_en, cr_number, sector, city, region,
        employee_count_bracket, contact_email, contact_phone,
        unified_national_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entityId,
        entityDto.nameAr.trim(),
        entityDto.nameEn?.trim() || null,
        entityDto.crNumber.trim(),
        entityDto.sector,
        entityDto.city.trim(),
        entityDto.region?.trim() || null,
        entityDto.employeeCountBracket || null,
        entityDto.contactEmail?.trim() || null,
        entityDto.contactPhone?.trim() || null,
        entityDto.unifiedNationalNumber?.trim() || null,
      ],
    );

    const userId = uuidv4();
    const firstName = userDto.firstName.trim();
    const lastName = userDto.lastName?.trim() || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    await this.databaseService.query(
      `INSERT INTO users (
        id, entity_id, first_name, last_name, full_name, email,
        password_hash, phone, job_role, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        entityId,
        firstName,
        lastName,
        fullName,
        normalizedEmail,
        this.hashPassword(userDto.password),
        userDto.phone?.trim() || null,
        userDto.jobRole?.trim() || null,
        'admin',
      ],
    );

    const user = (await this.findUserById(userId))!;
    const entity = (await this.findEntityById(entityId))!;

    return this.buildAuthResponse(user, entity);
  }

  async login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email.toLowerCase().trim();

    if (this.loginRateLimiter.isLocked(normalizedEmail)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.findUserByEmail(normalizedEmail);

    if (!user || !this.verifyPassword(loginDto.password, user.password)) {
      this.loginRateLimiter.recordFailure(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginRateLimiter.recordSuccess(normalizedEmail);
    const entity = (await this.findEntityById(user.entityId))!;

    return this.buildAuthResponse(user, entity);
  }

  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = forgotPasswordDto.email.toLowerCase().trim();
    const user = await this.findUserByEmail(normalizedEmail);

    if (!user) {
      return {
        message:
          'If an account exists for that email address, a reset link has been sent.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(
      Date.now() + this.passwordResetTtlMinutes * 60 * 1000,
    ).toISOString();

    await this.invalidatePasswordResetTokens(user.id);
    await this.databaseService.query(
      `INSERT INTO password_reset_tokens (
        id, user_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), user.id, tokenHash, expiresAt],
    );

    await this.authEmailService.sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      resetToken: rawToken,
      expiresInMinutes: this.passwordResetTtlMinutes,
    });

    this.logger.log(`Password reset requested for ${user.email}`);

    return {
      message:
        'If an account exists for that email address, a reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const tokenHash = this.hashResetToken(resetPasswordDto.token.trim());
    const tokenRecord = await this.findPasswordResetToken(tokenHash);

    if (!tokenRecord) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const user = await this.findUserById(tokenRecord.user_id);

    if (!user) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    await this.databaseService.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [this.hashPassword(resetPasswordDto.password), user.id],
    );
    await this.invalidatePasswordResetTokens(user.id);

    this.logger.log(`Password reset completed for ${user.email}`);

    return {
      message: 'Password updated successfully. You can now sign in.',
    };
  }

  async validateUser(userId: string) {
    return this.findUserById(userId);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const entity = (await this.findEntityById(user.entityId))!;
    return this.toSafeUser(user, entity);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.firstName !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(dto.firstName.trim());
    }

    if (dto.lastName !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(dto.lastName.trim() || null);
    }

    if (dto.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(dto.phone.trim() || null);
    }

    if (dto.jobRole !== undefined) {
      fields.push(`job_role = $${paramIndex++}`);
      values.push(dto.jobRole.trim() || null);
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const newFirst = dto.firstName?.trim() ?? user.firstName;
      const newLast = dto.lastName !== undefined ? (dto.lastName.trim() || null) : user.lastName;
      const newFullName = [newFirst, newLast].filter(Boolean).join(' ');
      fields.push(`full_name = $${paramIndex++}`);
      values.push(newFullName);
    }

    if (fields.length === 0) {
      const entity = (await this.findEntityById(user.entityId))!;
      return this.toSafeUser(user, entity);
    }

    values.push(userId);
    await this.databaseService.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    const updatedUser = (await this.findUserById(userId))!;
    const entity = (await this.findEntityById(updatedUser.entityId))!;
    return this.toSafeUser(updatedUser, entity);
  }

  async updateEntity(userId: string, dto: UpdateEntityDto): Promise<EntityRecord> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Only organization admins can update entity details');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const stringFields: Array<[keyof UpdateEntityDto, string]> = [
      ['nameAr', 'name_ar'],
      ['nameEn', 'name_en'],
      ['sector', 'sector'],
      ['city', 'city'],
      ['region', 'region'],
      ['employeeCountBracket', 'employee_count_bracket'],
      ['contactEmail', 'contact_email'],
      ['contactPhone', 'contact_phone'],
      ['unifiedNationalNumber', 'unified_national_number'],
    ];

    for (const [dtoKey, dbCol] of stringFields) {
      const val = dto[dtoKey];
      if (val !== undefined) {
        fields.push(`${dbCol} = $${paramIndex++}`);
        values.push(typeof val === 'string' ? val.trim() || null : null);
      }
    }

    if (fields.length === 0) {
      return (await this.findEntityById(user.entityId))!;
    }

    values.push(user.entityId);
    await this.databaseService.query(
      `UPDATE entities SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    return (await this.findEntityById(user.entityId))!;
  }

  // --- private helpers ---

  private buildAuthResponse(user: UserEntity, entity: EntityRecord) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return {
      user: this.toSafeUser(user, entity),
      accessToken: this.jwtService.sign(payload, {
        secret: jwtConstants.secret,
        expiresIn: jwtConstants.expiresIn,
      }),
    };
  }

  private toSafeUser(user: UserEntity, entity: EntityRecord): SafeUser {
    const { password, ...rest } = user;
    return { ...rest, entity };
  }

  private async findUserByEmail(email: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT id, entity_id, first_name, last_name, full_name, email,
              password_hash, phone, job_role, role, created_at
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findUserById(userId: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT id, entity_id, first_name, last_name, full_name, email,
              password_hash, phone, job_role, role, created_at
       FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findEntityById(entityId: string) {
    const result = await this.databaseService.query<EntityRow>(
      `SELECT id, name_ar, name_en, cr_number, sector, city, region,
              employee_count_bracket, contact_email, contact_phone,
              unified_national_number, created_at
       FROM entities WHERE id = $1`,
      [entityId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  private async findEntityByCrNumber(crNumber: string) {
    const result = await this.databaseService.query<EntityRow>(
      'SELECT id FROM entities WHERE cr_number = $1',
      [crNumber],
    );
    return result.rows[0] ?? null;
  }

  private async findPasswordResetToken(tokenHash: string) {
    const result = await this.databaseService.query<PasswordResetTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, consumed_at, created_at
       FROM password_reset_tokens
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  private async invalidatePasswordResetTokens(userId: string) {
    await this.databaseService.query(
      `UPDATE password_reset_tokens SET consumed_at = NOW()
       WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    );
  }

  private mapRowToUser(row: UserRow): UserEntity {
    return {
      id: row.id,
      entityId: row.entity_id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      email: row.email,
      password: row.password_hash,
      phone: row.phone,
      jobRole: row.job_role,
      role: row.role,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private mapRowToEntity(row: EntityRow): EntityRecord {
    return {
      id: row.id,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      crNumber: row.cr_number,
      sector: row.sector,
      city: row.city,
      region: row.region,
      employeeCountBracket: row.employee_count_bracket,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      unifiedNationalNumber: row.unified_national_number,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private verifyPassword(password: string, storedPassword: string) {
    const [salt, hash] = storedPassword.split(':');

    if (!salt || !hash) {
      return false;
    }

    const derivedBuffer = scryptSync(password, salt, 64);
    const hashBuffer = Buffer.from(hash, 'hex');

    if (derivedBuffer.length !== hashBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedBuffer, hashBuffer);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/auth/auth.service.ts
git commit -m "Rewrite AuthService with entity support, rate limiting, and profile updates"
```

---

## Task 6: Update AuthController

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`

- [ ] **Step 1: Replace auth controller with new endpoints**

Replace the entire contents of `apps/api/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('entity')
  updateEntity(@Req() req: AuthenticatedRequest, @Body() dto: UpdateEntityDto) {
    return this.authService.updateEntity(req.user.sub, dto);
  }
}
```

- [ ] **Step 2: Verify API compiles and starts**

Watch the terminal running `dev:api` — it should restart automatically. Look for:
```
Nest application successfully started
API listening on http://localhost:4000/api
```

If there are TypeScript errors, fix them before proceeding.

- [ ] **Step 3: Test registration with curl**

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {
      "nameAr": "شركة اختبار",
      "nameEn": "Test Company",
      "crNumber": "1010999999",
      "sector": "services",
      "city": "Riyadh"
    },
    "user": {
      "firstName": "Ahmed",
      "lastName": "Test",
      "email": "ahmed@test.com",
      "password": "TestPass1"
    }
  }' | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Expected: JSON with `accessToken`, `user` object containing nested `entity`.

- [ ] **Step 4: Test login with curl**

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ahmed@test.com", "password": "TestPass1"}' | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Expected: Same shape — `accessToken` + `user` with nested `entity`.

- [ ] **Step 5: Test GET /me**

Use the token from login response:

```bash
TOKEN="<paste token from step 4>"
curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Expected: User object with nested entity (no `accessToken` wrapper).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts
git commit -m "Add profile and entity update endpoints to auth controller"
```

---

## Task 7: Update Frontend Auth Client

**Files:**
- Modify: `apps/web/lib/auth-client.ts`

- [ ] **Step 1: Replace auth-client.ts with updated types and functions**

Replace the entire contents of `apps/web/lib/auth-client.ts`:

```typescript
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface EntityInfo {
  id: string;
  nameAr: string;
  nameEn: string | null;
  crNumber: string;
  sector: string;
  city: string;
  region: string | null;
  employeeCountBracket: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  unifiedNationalNumber: string | null;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  entityId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  jobRole: string | null;
  role: string;
  createdAt: string;
  entity: EntityInfo;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface RegisterPayload {
  entity: {
    nameAr: string;
    nameEn?: string;
    crNumber: string;
    sector: string;
    city: string;
    region?: string;
    employeeCountBracket?: string;
    contactEmail?: string;
    contactPhone?: string;
    unifiedNationalNumber?: string;
  };
  user: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    jobRole?: string;
    password: string;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobRole?: string;
}

export interface UpdateEntityPayload {
  nameAr?: string;
  nameEn?: string;
  sector?: string;
  city?: string;
  region?: string;
  employeeCountBracket?: string;
  contactEmail?: string;
  contactPhone?: string;
  unifiedNationalNumber?: string;
}

export interface ApiMessageResponse {
  message: string;
}

interface ErrorPayload {
  message?: string | string[];
}

async function parseError(response: Response) {
  const fallbackMessage = 'An unexpected error occurred.';

  try {
    const payload = (await response.json()) as ErrorPayload;

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }

    return payload.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function registerUser(payload: RegisterPayload) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestPasswordReset(payload: ForgotPasswordPayload) {
  return request<ApiMessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return request<ApiMessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchProfile(token: string) {
  return request<AuthUser>('/auth/me', {
    headers: authHeaders(token),
  });
}

export function updateProfile(token: string, payload: UpdateProfilePayload) {
  return request<AuthUser>('/auth/profile', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateEntity(token: string, payload: UpdateEntityPayload) {
  return request<EntityInfo>('/auth/entity', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export const authStorage = {
  tokenKey: 'env-project-token',
  userKey: 'env-project-user',
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/auth-client.ts
git commit -m "Update auth client with entity types and profile/entity update functions"
```

---

## Task 8: Rewrite Registration Form (Frontend)

**Files:**
- Modify: `apps/web/components/auth-form.tsx`

- [ ] **Step 1: Replace auth-form.tsx with two-section registration + existing login**

Replace the entire contents of `apps/web/components/auth-form.tsx`. This is a large file — the login section stays mostly the same, but the register section becomes a two-part form (Organization Details + Your Account):

```tsx
'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  authStorage,
  loginUser,
  registerUser,
  type AuthResponse,
} from '../lib/auth-client';
import { useLanguage } from './language-provider';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  mode: AuthMode;
}

const SECTORS = [
  { value: 'industrial', ar: 'صناعي', en: 'Industrial' },
  { value: 'oil_and_gas', ar: 'نفط وغاز', en: 'Oil & Gas' },
  { value: 'manufacturing', ar: 'تصنيع', en: 'Manufacturing' },
  { value: 'construction', ar: 'إنشاءات', en: 'Construction' },
  { value: 'services', ar: 'خدمات', en: 'Services' },
  { value: 'government', ar: 'حكومي', en: 'Government' },
  { value: 'healthcare', ar: 'رعاية صحية', en: 'Healthcare' },
  { value: 'education', ar: 'تعليم', en: 'Education' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

const EMPLOYEE_BRACKETS = [
  { value: '1-10', label: '1 – 10' },
  { value: '11-50', label: '11 – 50' },
  { value: '51-200', label: '51 – 200' },
  { value: '201-500', label: '201 – 500' },
  { value: '501-1000', label: '501 – 1000' },
  { value: '1000+', label: '1000+' },
];

export function AuthForm({ mode }: AuthFormProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isRegister = mode === 'register';

  // Entity fields
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [sector, setSector] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [employeeBracket, setEmployeeBracket] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [unifiedNumber, setUnifiedNumber] = useState('');

  // User fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  // UI state
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const content = useMemo(
    () =>
      isRegister
        ? {
            title: isArabic ? 'إنشاء حساب جديد' : 'Create a new account',
            submitLabel: isArabic ? 'إنشاء الحساب' : 'Create account',
            alternateText: isArabic ? 'لديك حساب بالفعل؟' : 'Already have an account?',
            alternateHref: '/login',
            alternateLabel: isArabic ? 'تسجيل الدخول' : 'Log in',
          }
        : {
            title: isArabic ? 'تسجيل الدخول إلى المنصة' : 'Log in to the platform',
            submitLabel: isArabic ? 'دخول' : 'Log in',
            alternateText: isArabic ? 'لا تملك حسابًا؟' : 'Need an account?',
            alternateHref: '/register',
            alternateLabel: isArabic ? 'إنشاء حساب' : 'Create one',
          },
    [isArabic, isRegister],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!nameAr.trim()) {
          throw new Error(isArabic ? 'اسم المنشأة بالعربية مطلوب.' : 'Organization name (Arabic) is required.');
        }
        if (!crNumber.trim()) {
          throw new Error(isArabic ? 'رقم السجل التجاري مطلوب.' : 'CR number is required.');
        }
        if (!sector) {
          throw new Error(isArabic ? 'القطاع مطلوب.' : 'Sector is required.');
        }
        if (!city.trim()) {
          throw new Error(isArabic ? 'المدينة مطلوبة.' : 'City is required.');
        }
        if (!firstName.trim()) {
          throw new Error(isArabic ? 'الاسم الأول مطلوب.' : 'First name is required.');
        }
        if (!email.trim()) {
          throw new Error(isArabic ? 'البريد الإلكتروني مطلوب.' : 'Email is required.');
        }
        if (!password) {
          throw new Error(isArabic ? 'كلمة المرور مطلوبة.' : 'Password is required.');
        }
        if (password.length < 8) {
          throw new Error(isArabic ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
          throw new Error(isArabic ? 'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم.' : 'Password must contain uppercase, lowercase, and a digit.');
        }
        if (password !== confirmPassword) {
          throw new Error(isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
        }
      }

      const response: AuthResponse = isRegister
        ? await registerUser({
            entity: {
              nameAr: nameAr.trim(),
              nameEn: nameEn.trim() || undefined,
              crNumber: crNumber.trim(),
              sector,
              city: city.trim(),
              region: region.trim() || undefined,
              employeeCountBracket: employeeBracket || undefined,
              contactEmail: contactEmail.trim() || undefined,
              contactPhone: contactPhone.trim() || undefined,
              unifiedNationalNumber: unifiedNumber.trim() || undefined,
            },
            user: {
              firstName: firstName.trim(),
              lastName: lastName.trim() || undefined,
              email: email.trim(),
              phone: phone.trim() || undefined,
              jobRole: jobRole.trim() || undefined,
              password,
            },
          })
        : await loginUser({ email, password });

      localStorage.setItem(authStorage.tokenKey, response.accessToken);
      localStorage.setItem(authStorage.userKey, JSON.stringify(response.user));
      setSuccessMessage(
        isRegister
          ? isArabic ? 'تم إنشاء الحساب بنجاح. يتم تحويلك...' : 'Account created. Redirecting...'
          : isArabic ? 'تم تسجيل الدخول بنجاح. يتم تحويلك...' : 'Login successful. Redirecting...',
      );
      window.location.replace('/account');
      return;
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : isArabic ? 'تعذر تنفيذ طلبك حاليًا.' : 'Unable to process your request right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordToggleLabel = isPasswordVisible
    ? isArabic ? 'إخفاء كلمة المرور' : 'Hide password'
    : isArabic ? 'إظهار كلمة المرور' : 'Show password';

  const confirmPasswordToggleLabel = isConfirmPasswordVisible
    ? isArabic ? 'إخفاء تأكيد كلمة المرور' : 'Hide confirm password'
    : isArabic ? 'إظهار تأكيد كلمة المرور' : 'Show confirm password';

  const eyeOpen = (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );

  const eyeClosed = (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 4.5L19.5 21" />
      <path d="M10.58 10.58A2 2 0 0013.4 13.4" />
      <path d="M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.58" />
      <path d="M6.61 6.61A11.84 11.84 0 001.5 12c.67 2.16 2.2 4.05 4.21 5.4A10.8 10.8 0 0012 19.1c1.3 0 2.54-.22 3.68-.62" />
    </svg>
  );

  // --- LOGIN FORM ---
  if (!isRegister) {
    return (
      <section className="auth-page-shell auth-page-shell-login">
        <div className="auth-page-card login-visual-panel">
          <div className="login-visual-top">
            <div className="login-brand-lockup">
              <span className="login-brand-mark">NE</span>
              <div className="login-brand-copy">
                <strong>{isArabic ? 'الأداة الوطنية' : 'National Tool'}</strong>
                <span>{isArabic ? 'منصة تقييم الامتثال البيئي' : 'Environmental compliance platform'}</span>
              </div>
            </div>
            <div className="login-visual-copy">
              <span className="section-label login-visual-badge">{isArabic ? 'وصول موثوق' : 'Trusted access'}</span>
              <h1>{isArabic ? 'مرحبًا بك مجددًا' : 'Welcome back'}</h1>
              <p>{isArabic ? 'سجّل الدخول للوصول إلى حسابك ومتابعة تقييمات الامتثال والتقارير البيئية بسهولة.' : 'Sign in to access your account and continue your compliance assessments and environmental reports.'}</p>
            </div>
          </div>
          <div className="login-benefits-list">
            <div className="login-benefit-item">
              <span className="login-benefit-icon">✓</span>
              <div>
                <strong>{isArabic ? 'تسجيل آمن وموثوق' : 'Secure and trusted sign-in'}</strong>
                <p>{isArabic ? 'مصادقة JWT مع تجربة دخول واضحة وسريعة.' : 'JWT authentication with a clear and fast sign-in flow.'}</p>
              </div>
            </div>
            <div className="login-benefit-item">
              <span className="login-benefit-icon">◎</span>
              <div>
                <strong>{isArabic ? 'تقاريرك في مكان واحد' : 'Your reports in one place'}</strong>
                <p>{isArabic ? 'الوصول إلى نتائجك ولوحات المتابعة بمجرد تسجيل الدخول.' : 'Open your results and monitoring dashboards right after login.'}</p>
              </div>
            </div>
            <div className="login-benefit-item">
              <span className="login-benefit-icon">↗</span>
              <div>
                <strong>{isArabic ? 'رحلة استخدام أبسط' : 'Simpler user journey'}</strong>
                <p>{isArabic ? 'تنقل سريع بين الحساب، المجالات، والتوصيات.' : 'Move quickly across account, domains, and recommendations.'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-page-card auth-form-card login-form-panel">
          <div className="login-form-header">
            <h2>{isArabic ? 'تسجيل الدخول' : 'Log in'}</h2>
            <p>{isArabic ? 'أدخل بياناتك للوصول إلى حسابك.' : 'Enter your details to access your account.'}</p>
          </div>

          <form className="auth-form login-form" onSubmit={handleSubmit}>
            <label className="auth-field login-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email address'}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isArabic ? 'ادخل بريدك الإلكتروني' : 'Enter your email'} required />
            </label>

            <label className="auth-field login-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'}</span>
              <div className="password-field-wrapper">
                <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter your password'} minLength={8} required />
                <button aria-label={passwordToggleLabel} className="password-toggle-button" onClick={() => setIsPasswordVisible((v) => !v)} type="button">
                  {isPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
            </label>

            <div className="login-form-options">
              <label className="login-remember-option">
                <input checked={rememberSession} onChange={(e) => setRememberSession(e.target.checked)} type="checkbox" />
                <span>{isArabic ? 'تذكرني' : 'Remember me'}</span>
              </label>
              <Link className="login-forgot-link" href="/forgot-password">{isArabic ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</Link>
            </div>

            {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}
            {successMessage ? <p className="auth-feedback auth-feedback-success">{successMessage}</p> : null}

            <button className="primary-btn auth-submit login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'تسجيل الدخول' : 'Log in')}
            </button>
          </form>

          <div className="login-form-divider"><span>{isArabic ? 'أو' : 'Or'}</span></div>

          <p className="auth-switch-link login-switch-link">
            {content.alternateText} <Link href={content.alternateHref}>{content.alternateLabel}</Link>
          </p>
        </div>
      </section>
    );
  }

  // --- REGISTER FORM ---
  return (
    <section className="register-shell">
      <div className="register-card">
        <div className="register-card-header">
          <h1>{isArabic ? 'تسجيل منشأة جديدة' : 'Register a new organization'}</h1>
          <p>{isArabic ? 'أدخل بيانات المنشأة ثم أنشئ حسابك كمسؤول.' : 'Enter organization details, then create your admin account.'}</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          {/* Section 1: Organization */}
          <div className="register-section-heading">
            <span>{isArabic ? 'بيانات المنشأة' : 'Organization details'}</span>
          </div>

          <div className="register-form-grid">
            <label className="register-field">
              <span>{isArabic ? 'اسم المنشأة (عربي)' : 'Organization name (Arabic)'} <em>*</em></span>
              <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={isArabic ? 'ادخل اسم المنشأة بالعربية' : 'Enter name in Arabic'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'اسم المنشأة (إنجليزي)' : 'Organization name (English)'}</span>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder={isArabic ? 'ادخل اسم المنشأة بالإنجليزية' : 'Enter name in English'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'رقم السجل التجاري' : 'CR number'} <em>*</em></span>
              <input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} placeholder={isArabic ? 'مثال: 1010234567' : 'e.g. 1010234567'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'القطاع' : 'Sector'} <em>*</em></span>
              <select value={sector} onChange={(e) => setSector(e.target.value)} required>
                <option value="">{isArabic ? 'اختر القطاع' : 'Select sector'}</option>
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{isArabic ? s.ar : s.en}</option>
                ))}
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'المدينة' : 'City'} <em>*</em></span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={isArabic ? 'مثال: الرياض' : 'e.g. Riyadh'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'المنطقة' : 'Region'}</span>
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={isArabic ? 'مثال: منطقة الرياض' : 'e.g. Riyadh Region'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'عدد الموظفين' : 'Number of employees'}</span>
              <select value={employeeBracket} onChange={(e) => setEmployeeBracket(e.target.value)}>
                <option value="">{isArabic ? 'اختر الفئة' : 'Select bracket'}</option>
                {EMPLOYEE_BRACKETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني للمنشأة' : 'Organization email'}</span>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={isArabic ? 'info@company.sa' : 'info@company.sa'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'هاتف المنشأة' : 'Organization phone'}</span>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder={isArabic ? '+966112345678' : '+966112345678'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الرقم الموحد' : 'Unified national number'}</span>
              <input value={unifiedNumber} onChange={(e) => setUnifiedNumber(e.target.value)} placeholder={isArabic ? '7001234567' : '7001234567'} />
            </label>
          </div>

          {/* Section 2: User Account */}
          <div className="register-section-heading register-section-heading-account">
            <span>{isArabic ? 'حسابك' : 'Your account'}</span>
          </div>

          <div className="register-form-grid">
            <label className="register-field">
              <span>{isArabic ? 'الاسم الأول' : 'First name'} <em>*</em></span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={isArabic ? 'ادخل الاسم الأول' : 'Enter first name'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الاسم الأخير' : 'Last name'}</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={isArabic ? 'ادخل الاسم الأخير' : 'Enter last name'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email'} <em>*</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isArabic ? 'ادخل البريد الإلكتروني' : 'Enter email address'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'رقم الجوال' : 'Mobile number'}</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isArabic ? '05XXXXXXXX' : '05XXXXXXXX'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span>
              <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder={isArabic ? 'مثال: مدير بيئي' : 'e.g. Environmental Manager'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'} <em>*</em></span>
              <div className="password-field-wrapper register-password-field-wrapper">
                <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter password'} minLength={8} required />
                <button aria-label={passwordToggleLabel} className="password-toggle-button register-password-toggle" onClick={() => setIsPasswordVisible((v) => !v)} type="button">
                  {isPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
              <small className="register-password-hint">{isArabic ? '8 أحرف على الأقل، حرف كبير، حرف صغير، ورقم' : 'Min 8 chars, uppercase, lowercase, and a digit'}</small>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'تأكيد كلمة المرور' : 'Confirm password'} <em>*</em></span>
              <div className="password-field-wrapper register-password-field-wrapper">
                <input type={isConfirmPasswordVisible ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={isArabic ? 'أعد إدخال كلمة المرور' : 'Re-enter password'} minLength={8} required />
                <button aria-label={confirmPasswordToggleLabel} className="password-toggle-button register-password-toggle" onClick={() => setIsConfirmPasswordVisible((v) => !v)} type="button">
                  {isConfirmPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
            </label>
          </div>

          {error ? <p className="auth-feedback auth-feedback-error register-feedback">{error}</p> : null}
          {successMessage ? <p className="auth-feedback auth-feedback-success register-feedback">{successMessage}</p> : null}

          <div className="register-actions">
            <Link className="secondary-btn register-cancel-button" href="/login">{isArabic ? 'إلغاء' : 'Cancel'}</Link>
            <button className="primary-btn register-submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'إنشاء الحساب' : 'Create account')}
            </button>
          </div>
        </form>

        <p className="register-switch-link">
          {content.alternateText} <Link href={content.alternateHref}>{content.alternateLabel}</Link>
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add CSS for password hint and section spacing**

Append to the end of `apps/web/app/globals.css`:

```css
/* --- M1: Register form section spacing --- */
.register-section-heading-account {
  margin-top: 28px;
}

.register-password-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b8a82;
}
```

- [ ] **Step 3: Verify the register page loads at http://localhost:3000/register**

Open the browser and confirm the form renders with two sections. No need to submit yet — just verify it displays properly with both organization and account sections.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/auth-form.tsx apps/web/app/globals.css
git commit -m "Restructure registration form with org details and user account sections"
```

---

## Task 9: Update Account Page with Entity Info

**Files:**
- Modify: `apps/web/components/account-panel.tsx`

- [ ] **Step 1: Replace account-panel.tsx with entity info and edit support**

Replace the entire contents of `apps/web/components/account-panel.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  authStorage,
  fetchProfile,
  updateEntity,
  updateProfile,
  type AuthUser,
} from '../lib/auth-client';
import { useLanguage } from './language-provider';

export function AccountPanel() {
  const { language } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingEntity, setEditingEntity] = useState(false);
  const [saving, setSaving] = useState(false);
  const isArabic = language === 'ar';

  // Profile edit state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editJobRole, setEditJobRole] = useState('');

  // Entity edit state
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem(authStorage.tokenKey);

      if (!token) {
        setError(isArabic ? 'لا توجد جلسة نشطة. يرجى تسجيل الدخول أولاً.' : 'No active session. Please log in first.');
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile(token);
        setUser(profile);
        localStorage.setItem(authStorage.userKey, JSON.stringify(profile));
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : isArabic ? 'تعذر تحميل بيانات المستخدم.' : 'Unable to load user data.',
        );
        localStorage.removeItem(authStorage.tokenKey);
        localStorage.removeItem(authStorage.userKey);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [isArabic]);

  function logout() {
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.userKey);
    setUser(null);
    setError(isArabic ? 'تم إنهاء الجلسة.' : 'Session cleared.');
  }

  function startEditProfile() {
    if (!user) return;
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName ?? '');
    setEditPhone(user.phone ?? '');
    setEditJobRole(user.jobRole ?? '');
    setEditingProfile(true);
  }

  function startEditEntity() {
    if (!user) return;
    setEditNameAr(user.entity.nameAr);
    setEditNameEn(user.entity.nameEn ?? '');
    setEditContactEmail(user.entity.contactEmail ?? '');
    setEditContactPhone(user.entity.contactPhone ?? '');
    setEditingEntity(true);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem(authStorage.tokenKey)!;
      const updated = await updateProfile(token, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        jobRole: editJobRole.trim() || undefined,
      });
      setUser(updated);
      localStorage.setItem(authStorage.userKey, JSON.stringify(updated));
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : isArabic ? 'فشل التحديث.' : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntity(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem(authStorage.tokenKey)!;
      const updatedEntity = await updateEntity(token, {
        nameAr: editNameAr.trim(),
        nameEn: editNameEn.trim() || undefined,
        contactEmail: editContactEmail.trim() || undefined,
        contactPhone: editContactPhone.trim() || undefined,
      });
      setUser((prev) => prev ? { ...prev, entity: updatedEntity } : prev);
      setEditingEntity(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : isArabic ? 'فشل التحديث.' : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  const sectorLabels: Record<string, { ar: string; en: string }> = {
    industrial: { ar: 'صناعي', en: 'Industrial' },
    oil_and_gas: { ar: 'نفط وغاز', en: 'Oil & Gas' },
    manufacturing: { ar: 'تصنيع', en: 'Manufacturing' },
    construction: { ar: 'إنشاءات', en: 'Construction' },
    services: { ar: 'خدمات', en: 'Services' },
    government: { ar: 'حكومي', en: 'Government' },
    healthcare: { ar: 'رعاية صحية', en: 'Healthcare' },
    education: { ar: 'تعليم', en: 'Education' },
    other: { ar: 'أخرى', en: 'Other' },
  };

  if (isLoading) {
    return (
      <section className="auth-page-shell">
        <div className="auth-page-card auth-form-card">
          <p className="auth-feedback">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="auth-page-shell">
        <div className="auth-page-card auth-form-card">
          <p className="auth-feedback auth-feedback-error">{error}</p>
          <div className="auth-inline-links">
            <Link href="/login">{isArabic ? 'تسجيل الدخول' : 'Log in'}</Link>
            <Link href="/register">{isArabic ? 'إنشاء حساب' : 'Create account'}</Link>
          </div>
        </div>
      </section>
    );
  }

  const entity = user.entity;
  const sectorLabel = sectorLabels[entity.sector] ?? { ar: entity.sector, en: entity.sector };

  return (
    <section className="account-page-shell">
      {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}

      {/* Entity Card */}
      <div className="account-card">
        <div className="account-card-header">
          <h2>{isArabic ? 'بيانات المنشأة' : 'Organization details'}</h2>
          {user.role === 'admin' && !editingEntity && (
            <button className="secondary-btn account-edit-btn" onClick={startEditEntity} type="button">
              {isArabic ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>

        {editingEntity ? (
          <form className="account-edit-form" onSubmit={handleSaveEntity}>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم (عربي)' : 'Name (Arabic)'}</span>
              <input value={editNameAr} onChange={(e) => setEditNameAr(e.target.value)} required />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم (إنجليزي)' : 'Name (English)'}</span>
              <input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Contact email'}</span>
              <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الهاتف' : 'Contact phone'}</span>
              <input type="tel" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
            </label>
            <div className="account-edit-actions">
              <button className="secondary-btn" onClick={() => setEditingEntity(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
              <button className="primary-btn" disabled={saving} type="submit">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}</button>
            </div>
          </form>
        ) : (
          <div className="account-grid">
            <div className="account-item"><span>{isArabic ? 'الاسم (عربي)' : 'Name (Arabic)'}</span><strong>{entity.nameAr}</strong></div>
            {entity.nameEn && <div className="account-item"><span>{isArabic ? 'الاسم (إنجليزي)' : 'Name (English)'}</span><strong>{entity.nameEn}</strong></div>}
            <div className="account-item"><span>{isArabic ? 'السجل التجاري' : 'CR number'}</span><strong>{entity.crNumber}</strong></div>
            <div className="account-item"><span>{isArabic ? 'القطاع' : 'Sector'}</span><strong>{isArabic ? sectorLabel.ar : sectorLabel.en}</strong></div>
            <div className="account-item"><span>{isArabic ? 'المدينة' : 'City'}</span><strong>{entity.city}</strong></div>
            {entity.region && <div className="account-item"><span>{isArabic ? 'المنطقة' : 'Region'}</span><strong>{entity.region}</strong></div>}
            {entity.employeeCountBracket && <div className="account-item"><span>{isArabic ? 'عدد الموظفين' : 'Employees'}</span><strong>{entity.employeeCountBracket}</strong></div>}
            {entity.contactEmail && <div className="account-item"><span>{isArabic ? 'البريد' : 'Email'}</span><strong>{entity.contactEmail}</strong></div>}
            {entity.contactPhone && <div className="account-item"><span>{isArabic ? 'الهاتف' : 'Phone'}</span><strong>{entity.contactPhone}</strong></div>}
            {entity.unifiedNationalNumber && <div className="account-item"><span>{isArabic ? 'الرقم الموحد' : 'Unified number'}</span><strong>{entity.unifiedNationalNumber}</strong></div>}
          </div>
        )}
      </div>

      {/* User Card */}
      <div className="account-card">
        <div className="account-card-header">
          <h2>{isArabic ? 'معلوماتك' : 'Your profile'}</h2>
          {!editingProfile && (
            <button className="secondary-btn account-edit-btn" onClick={startEditProfile} type="button">
              {isArabic ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>

        {editingProfile ? (
          <form className="account-edit-form" onSubmit={handleSaveProfile}>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم الأول' : 'First name'}</span>
              <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الاسم الأخير' : 'Last name'}</span>
              <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الجوال' : 'Phone'}</span>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </label>
            <label className="account-edit-field">
              <span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span>
              <input value={editJobRole} onChange={(e) => setEditJobRole(e.target.value)} />
            </label>
            <div className="account-edit-actions">
              <button className="secondary-btn" onClick={() => setEditingProfile(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
              <button className="primary-btn" disabled={saving} type="submit">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ' : 'Save')}</button>
            </div>
          </form>
        ) : (
          <div className="account-grid">
            <div className="account-item"><span>{isArabic ? 'الاسم الكامل' : 'Full name'}</span><strong>{user.fullName}</strong></div>
            <div className="account-item"><span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span><strong>{user.email}</strong></div>
            {user.phone && <div className="account-item"><span>{isArabic ? 'الجوال' : 'Phone'}</span><strong>{user.phone}</strong></div>}
            {user.jobRole && <div className="account-item"><span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span><strong>{user.jobRole}</strong></div>}
            <div className="account-item"><span>{isArabic ? 'الصلاحية' : 'Role'}</span><strong>{user.role === 'admin' ? (isArabic ? 'مسؤول' : 'Admin') : (isArabic ? 'مستخدم' : 'User')}</strong></div>
            <div className="account-item"><span>{isArabic ? 'تاريخ الإنشاء' : 'Created'}</span><strong>{new Date(user.createdAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</strong></div>
          </div>
        )}
      </div>

      <button className="secondary-btn account-logout-btn" onClick={logout} type="button">
        {isArabic ? 'تسجيل الخروج' : 'Log out'}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Add CSS for account page layout**

Append to the end of `apps/web/app/globals.css`:

```css
/* --- M1: Account page --- */
.account-page-shell {
  width: min(900px, calc(100% - 32px));
  margin: 40px auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.account-card {
  background: var(--white);
  border-radius: 16px;
  padding: 28px;
  color: #17302c;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.account-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.account-card-header h2 {
  margin: 0;
  font-size: 18px;
}

.account-edit-btn {
  font-size: 13px;
  padding: 6px 16px;
}

.account-edit-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.account-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-edit-field span {
  font-size: 13px;
  color: #4d6761;
}

.account-edit-field input {
  padding: 10px 14px;
  border: 1px solid #d5ddd9;
  border-radius: 10px;
  font-size: 14px;
  background: #f7fbf9;
}

.account-edit-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.account-logout-btn {
  align-self: flex-start;
}
```

- [ ] **Step 3: Verify account page at http://localhost:3000/account**

Log in first (if not already), then visit /account. Confirm:
- Entity section shows organization details
- User section shows personal info
- Edit buttons appear and toggle inline forms
- Logout works

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/account-panel.tsx apps/web/app/globals.css
git commit -m "Update account page with entity info display and inline editing"
```

---

## Task 10: End-to-End Smoke Test

- [ ] **Step 1: Clean test — drop all data and register fresh**

```bash
cd apps/api
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ host:'127.0.0.1', port:5433, user:'postgres', password:'postgres', database:'env_project' });
  await c.connect();
  await c.query('DELETE FROM password_reset_tokens');
  await c.query('DELETE FROM users');
  await c.query('DELETE FROM entities');
  console.log('Data cleared');
  await c.end();
})();
"
```

- [ ] **Step 2: Register via the UI**

1. Open http://localhost:3000/register
2. Fill in Organization section (Arabic name, CR number, sector, city)
3. Fill in Account section (first name, email, password meeting policy)
4. Submit
5. Verify redirect to /account
6. Verify entity info and user info display correctly

- [ ] **Step 3: Log out and log back in**

1. Click logout on account page
2. Go to /login
3. Log in with the same credentials
4. Verify redirect to /account with correct data

- [ ] **Step 4: Test profile edit**

1. On /account, click Edit on "Your profile"
2. Change first name or job role
3. Save
4. Verify the display updates

- [ ] **Step 5: Test entity edit (admin only)**

1. On /account, click Edit on "Organization details"
2. Change the English name
3. Save
4. Verify the display updates

- [ ] **Step 6: Test brute-force protection**

```bash
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ahmed@test.com","password":"WrongPass1"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).message))"
done
```

Expected: All 6 return "Invalid credentials". After attempt 5, account is locked for 15 minutes. Even correct password should fail during lockout.

- [ ] **Step 7: Test duplicate CR number rejection**

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {"nameAr":"منشأة ثانية","crNumber":"SAME_CR_AS_FIRST","sector":"services","city":"Jeddah"},
    "user": {"firstName":"Ali","email":"ali@test.com","password":"TestPass1"}
  }'
```

Expected: 400 error — "An organization with this CR number already exists"

- [ ] **Step 8: Test password policy rejection**

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {"nameAr":"منشأة أخرى","crNumber":"9999999999","sector":"services","city":"Jeddah"},
    "user": {"firstName":"Ali","email":"ali@test.com","password":"weak"}
  }'
```

Expected: 400 error — validation message about password requirements

- [ ] **Step 9: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "Fix any issues found during M1 smoke testing"
```

Only commit if changes were made during testing. Skip if everything passed cleanly.
