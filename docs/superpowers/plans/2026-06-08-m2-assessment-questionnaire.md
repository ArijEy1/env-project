# M2 — Assessment Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a wizard-style assessment questionnaire with 18 questions across 2 domains, auto-save, progress tracking, and resume support.

**Architecture:** Questions defined in code (easy to swap). Assessments and answers stored in PostgreSQL. Wizard frontend with one question per page, progress bar, and auto-save on answer selection. New NestJS assessment module with its own controller/service.

**Tech Stack:** NestJS, PostgreSQL (via `pg`), Next.js 15, React 19, class-validator

**Spec:** `docs/superpowers/specs/2026-06-08-m2-assessment-questionnaire-design.md`

---

## Task 1: Database Tables for Assessments

**Files:**
- Modify: `apps/api/src/database/database.service.ts`

- [ ] **Step 1: Add `ensureAssessmentsTable()` method**

Add this method after `ensurePasswordResetTokensTable()` in `apps/api/src/database/database.service.ts`:

```typescript
private async ensureAssessmentsTable() {
  await this.pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id UUID PRIMARY KEY,
      entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      current_question_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    )
  `);

  await this.pool.query(
    'CREATE INDEX IF NOT EXISTS assessments_entity_id_idx ON assessments (entity_id)',
  );
  await this.pool.query(
    'CREATE INDEX IF NOT EXISTS assessments_status_idx ON assessments (status)',
  );
}
```

- [ ] **Step 2: Add `ensureAssessmentAnswersTable()` method**

Add this method after `ensureAssessmentsTable()`:

```typescript
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
```

- [ ] **Step 3: Call both new methods in `onModuleInit()`**

Add after the `ensurePasswordResetTokensTable()` call:

```typescript
await this.ensureAssessmentsTable();
await this.ensureAssessmentAnswersTable();
```

The full `onModuleInit` should now be:

```typescript
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
```

- [ ] **Step 4: Verify tables are created**

Wait for the API to auto-restart (ts-node-dev), then verify:

```bash
cd apps/api && node -e "
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

Expected: `['assessment_answers', 'assessments', 'entities', 'password_reset_tokens', 'users']`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/database.service.ts
git commit -m "Add assessments and assessment_answers tables"
```

---

## Task 2: Questions Definition File

**Files:**
- Create: `apps/api/src/assessment/questions.ts`

- [ ] **Step 1: Create the questions file**

Create `apps/api/src/assessment/questions.ts`:

```typescript
export interface AnswerOption {
  score: number;
  labelAr: string;
  labelEn: string;
}

export interface Question {
  id: string;
  domain: 'governance' | 'compliance';
  textAr: string;
  textEn: string;
}

export interface Domain {
  id: 'governance' | 'compliance';
  nameAr: string;
  nameEn: string;
  weight: number;
}

export const DOMAINS: Domain[] = [
  { id: 'governance', nameAr: 'الحوكمة البيئية', nameEn: 'Environmental Governance', weight: 0.45 },
  { id: 'compliance', nameAr: 'الامتثال التنظيمي', nameEn: 'Regulatory Compliance', weight: 0.55 },
];

export const ANSWER_OPTIONS: AnswerOption[] = [
  { score: 0, labelAr: 'لا يوجد', labelEn: 'Does not exist' },
  { score: 25, labelAr: 'في مرحلة التخطيط', labelEn: 'In planning stage' },
  { score: 50, labelAr: 'مطبّق جزئيًا', labelEn: 'Partially implemented' },
  { score: 75, labelAr: 'مطبّق بشكل كبير', labelEn: 'Largely implemented' },
  { score: 100, labelAr: 'مطبّق بالكامل ومُراجَع دوريًا', labelEn: 'Fully implemented and periodically reviewed' },
];

export const VALID_SCORES = ANSWER_OPTIONS.map((o) => o.score);

export const QUESTIONS: Question[] = [
  // Domain 1: Environmental Governance
  { id: 'GOV_01', domain: 'governance', textAr: 'هل لدى منشأتكم سياسة بيئية موثقة ومعتمدة؟', textEn: 'Does your organization have a documented and approved environmental policy?' },
  { id: 'GOV_02', domain: 'governance', textAr: 'هل يوجد فريق أو مسؤول مختص بالإدارة البيئية؟', textEn: 'Is there a dedicated environmental management team or officer?' },
  { id: 'GOV_03', domain: 'governance', textAr: 'هل تم دمج الأهداف البيئية في التخطيط الاستراتيجي للمنشأة؟', textEn: 'Are environmental objectives integrated into the organization\'s strategic planning?' },
  { id: 'GOV_04', domain: 'governance', textAr: 'هل يقوم مجلس الإدارة أو القيادة العليا بالإشراف على الشؤون البيئية؟', textEn: 'Does the board or senior leadership provide oversight on environmental matters?' },
  { id: 'GOV_05', domain: 'governance', textAr: 'هل توجد ميزانية مخصصة للبرامج البيئية والامتثال؟', textEn: 'Is there a dedicated budget allocated for environmental programs and compliance?' },
  { id: 'GOV_06', domain: 'governance', textAr: 'هل توفر المنشأة برامج تدريب وتوعية بيئية للموظفين؟', textEn: 'Does the organization provide environmental awareness training for employees?' },
  { id: 'GOV_07', domain: 'governance', textAr: 'هل توجد آلية لإشراك أصحاب المصلحة في القضايا البيئية؟', textEn: 'Is there a process for engaging stakeholders on environmental issues?' },
  { id: 'GOV_08', domain: 'governance', textAr: 'هل تجري المنشأة عمليات تدقيق بيئي داخلية؟', textEn: 'Does the organization conduct internal environmental audits?' },
  { id: 'GOV_09', domain: 'governance', textAr: 'هل يتم تتبع مؤشرات الأداء البيئي ورفعها للإدارة؟', textEn: 'Are environmental KPIs tracked and reported to management?' },

  // Domain 2: Regulatory Compliance
  { id: 'COM_01', domain: 'compliance', textAr: 'هل تمتلك منشأتكم جميع التراخيص والتصاريح البيئية المطلوبة من المركز الوطني للرقابة البيئية؟', textEn: 'Does your organization hold all required NCEC environmental licenses and permits?' },
  { id: 'COM_02', domain: 'compliance', textAr: 'هل تلتزم المنشأة بأنظمة وزارة البيئة والمياه والزراعة المتعلقة بالمياه والصرف؟', textEn: 'Is the organization compliant with MEWA water and wastewater regulations?' },
  { id: 'COM_03', domain: 'compliance', textAr: 'هل تجري المنشأة تقييمات الأثر البيئي للمشاريع الجديدة؟', textEn: 'Does the organization conduct environmental impact assessments for new projects?' },
  { id: 'COM_04', domain: 'compliance', textAr: 'هل يوجد نظام إدارة نفايات موثق ومتوافق مع المتطلبات التنظيمية؟', textEn: 'Is there a documented waste management system compliant with regulatory requirements?' },
  { id: 'COM_05', domain: 'compliance', textAr: 'هل تراقب المنشأة انبعاثاتها الهوائية وتبلغ عنها وفقًا للأنظمة؟', textEn: 'Does the organization monitor and report air emissions as required by regulations?' },
  { id: 'COM_06', domain: 'compliance', textAr: 'هل يتم التعامل مع المواد الخطرة وتخزينها والتخلص منها وفقًا للأنظمة؟', textEn: 'Are hazardous materials handled, stored, and disposed of according to regulations?' },
  { id: 'COM_07', domain: 'compliance', textAr: 'هل تبنت المنشأة نظام إدارة بيئية ISO 14001 أو ما يعادله؟', textEn: 'Has the organization adopted ISO 14001 or an equivalent environmental management system?' },
  { id: 'COM_08', domain: 'compliance', textAr: 'هل المنشأة مستعدة للتفتيش التنظيمي في أي وقت؟', textEn: 'Is the organization prepared for regulatory inspections at any time?' },
  { id: 'COM_09', domain: 'compliance', textAr: 'هل توجد إجراءات موثقة للإبلاغ عن الحوادث البيئية؟', textEn: 'Are there documented procedures for reporting environmental incidents?' },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
export const TOTAL_QUESTIONS = QUESTIONS.length;

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/assessment/questions.ts
git commit -m "Add assessment questions definition with 18 bilingual questions"
```

---

## Task 3: Assessment DTOs

**Files:**
- Create: `apps/api/src/assessment/dto/save-answer.dto.ts`
- Create: `apps/api/src/assessment/dto/update-progress.dto.ts`

- [ ] **Step 1: Create save-answer DTO**

Create `apps/api/src/assessment/dto/save-answer.dto.ts`:

```typescript
import { IsIn, IsInt, IsString } from 'class-validator';
import { QUESTION_IDS, VALID_SCORES } from '../questions';

export class SaveAnswerDto {
  @IsString()
  @IsIn(QUESTION_IDS)
  questionId!: string;

  @IsInt()
  @IsIn(VALID_SCORES)
  score!: number;
}
```

- [ ] **Step 2: Create update-progress DTO**

Create `apps/api/src/assessment/dto/update-progress.dto.ts`:

```typescript
import { IsInt, Max, Min } from 'class-validator';
import { TOTAL_QUESTIONS } from '../questions';

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(TOTAL_QUESTIONS - 1)
  currentQuestionIndex!: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/assessment/dto/save-answer.dto.ts apps/api/src/assessment/dto/update-progress.dto.ts
git commit -m "Add assessment DTOs for answer saving and progress tracking"
```

---

## Task 4: Assessment Service

**Files:**
- Create: `apps/api/src/assessment/assessment.service.ts`

- [ ] **Step 1: Create the assessment service**

Create `apps/api/src/assessment/assessment.service.ts`:

```typescript
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

interface AssessmentRow {
  id: string;
  entity_id: string;
  user_id: string;
  status: string;
  current_question_index: number;
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
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string) {
    const entityId = await this.getEntityId(userId);

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

    return this.getById(id, userId);
  }

  async list(userId: string) {
    const entityId = await this.getEntityId(userId);

    const result = await this.db.query<AssessmentRow>(
      `SELECT id, entity_id, user_id, status, current_question_index, created_at, submitted_at
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

    await this.db.query(
      "UPDATE assessments SET status = 'submitted', submitted_at = NOW() WHERE id = $1",
      [assessmentId],
    );

    return this.getById(assessmentId, userId);
  }

  private async findAssessment(id: string) {
    const result = await this.db.query<AssessmentRow>(
      `SELECT id, entity_id, user_id, status, current_question_index, created_at, submitted_at
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

  private toIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/assessment/assessment.service.ts
git commit -m "Add assessment service with CRUD, answer saving, and submit logic"
```

---

## Task 5: Assessment Controller & Module

**Files:**
- Create: `apps/api/src/assessment/assessment.controller.ts`
- Create: `apps/api/src/assessment/assessment.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the assessment controller**

Create `apps/api/src/assessment/assessment.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AssessmentService } from './assessment.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest) {
    return this.assessmentService.create(req.user.sub);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.assessmentService.list(req.user.sub);
  }

  @Get('questions')
  getQuestions() {
    const { QUESTIONS, DOMAINS, ANSWER_OPTIONS, TOTAL_QUESTIONS } = require('./questions');
    return { questions: QUESTIONS, domains: DOMAINS, answerOptions: ANSWER_OPTIONS, totalQuestions: TOTAL_QUESTIONS };
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assessmentService.getById(id, req.user.sub);
  }

  @Put(':id/answer')
  saveAnswer(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.assessmentService.saveAnswer(id, req.user.sub, dto);
  }

  @Put(':id/progress')
  updateProgress(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.assessmentService.updateProgress(id, req.user.sub, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assessmentService.submit(id, req.user.sub);
  }
}
```

- [ ] **Step 2: Create the assessment module**

Create `apps/api/src/assessment/assessment.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AssessmentController],
  providers: [AssessmentService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
```

- [ ] **Step 3: Register AssessmentModule in AppModule**

Replace `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AssessmentModule } from './assessment/assessment.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, AssessmentModule],
})
export class AppModule {}
```

- [ ] **Step 4: Verify API starts and test with curl**

Wait for auto-restart, then test:

```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"ahmed@envco.sa","password":"SecurePass1"}' | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).accessToken))")

# Get questions
curl -s http://localhost:4000/api/assessments/questions -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Questions:',j.totalQuestions,'Domains:',j.domains.length)})"

# Create assessment
curl -s -X POST http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Created:',j.id,'Status:',j.status)})"
```

Expected: `Questions: 18 Domains: 2` and `Created: <uuid> Status: draft`

- [ ] **Step 5: Test save answer and list**

```bash
# Get the assessment ID from the previous step
ASSESSMENT_ID=$(curl -s http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d)[0].id))")

# Save an answer
curl -s -X PUT "http://localhost:4000/api/assessments/$ASSESSMENT_ID/answer" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"questionId":"GOV_01","score":75}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# Get assessment with answers
curl -s "http://localhost:4000/api/assessments/$ASSESSMENT_ID" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Answers:',j.answers.length,'Status:',j.status)})"
```

Expected: `{ questionId: 'GOV_01', score: 75 }` and `Answers: 1 Status: draft`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/assessment/assessment.controller.ts apps/api/src/assessment/assessment.module.ts apps/api/src/app.module.ts
git commit -m "Add assessment controller, module, and register in app"
```

---

## Task 6: Frontend Assessment Client

**Files:**
- Create: `apps/web/lib/assessment-client.ts`

- [ ] **Step 1: Create the assessment API client**

Create `apps/web/lib/assessment-client.ts`:

```typescript
import { apiBaseUrl, authStorage } from './auth-client';

export interface AssessmentAnswer {
  questionId: string;
  score: number;
}

export interface Assessment {
  id: string;
  entityId: string;
  userId: string;
  status: 'draft' | 'submitted';
  currentQuestionIndex: number;
  createdAt: string;
  submittedAt: string | null;
  answers: AssessmentAnswer[];
}

export interface AssessmentListItem {
  id: string;
  entityId: string;
  userId: string;
  status: 'draft' | 'submitted';
  currentQuestionIndex: number;
  createdAt: string;
  submittedAt: string | null;
  answeredCount: number;
  totalQuestions: number;
}

export interface QuestionDef {
  id: string;
  domain: 'governance' | 'compliance';
  textAr: string;
  textEn: string;
}

export interface DomainDef {
  id: 'governance' | 'compliance';
  nameAr: string;
  nameEn: string;
  weight: number;
}

export interface AnswerOptionDef {
  score: number;
  labelAr: string;
  labelEn: string;
}

export interface QuestionsData {
  questions: QuestionDef[];
  domains: DomainDef[];
  answerOptions: AnswerOptionDef[];
  totalQuestions: number;
}

interface ErrorPayload {
  message?: string | string[];
}

function getToken(): string {
  const token = localStorage.getItem(authStorage.tokenKey);
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let msg = 'Request failed';
    try {
      const payload = (await response.json()) as ErrorPayload;
      msg = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message ?? msg;
    } catch {}
    throw new Error(msg);
  }

  return (await response.json()) as T;
}

export function fetchQuestions() {
  return request<QuestionsData>('/assessments/questions');
}

export function createAssessment() {
  return request<Assessment>('/assessments', { method: 'POST' });
}

export function listAssessments() {
  return request<AssessmentListItem[]>('/assessments');
}

export function getAssessment(id: string) {
  return request<Assessment>(`/assessments/${id}`);
}

export function saveAnswer(assessmentId: string, questionId: string, score: number) {
  return request<AssessmentAnswer>(`/assessments/${assessmentId}/answer`, {
    method: 'PUT',
    body: JSON.stringify({ questionId, score }),
  });
}

export function updateProgress(assessmentId: string, currentQuestionIndex: number) {
  return request<{ currentQuestionIndex: number }>(`/assessments/${assessmentId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ currentQuestionIndex }),
  });
}

export function submitAssessment(assessmentId: string) {
  return request<Assessment>(`/assessments/${assessmentId}/submit`, { method: 'POST' });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/assessment-client.ts
git commit -m "Add assessment API client with all endpoint functions"
```

---

## Task 7: Assessment Wizard Component

**Files:**
- Create: `apps/web/components/assessment-wizard.tsx`

- [ ] **Step 1: Create the wizard component**

Create `apps/web/components/assessment-wizard.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAssessment,
  fetchQuestions,
  saveAnswer,
  updateProgress,
  submitAssessment,
  type Assessment,
  type QuestionsData,
} from '../lib/assessment-client';
import { useLanguage } from './language-provider';

interface AssessmentWizardProps {
  assessmentId: string;
}

export function AssessmentWizard({ assessmentId }: AssessmentWizardProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [qData, aData] = await Promise.all([
          fetchQuestions(),
          getAssessment(assessmentId),
        ]);
        setQuestionsData(qData);
        setAssessment(aData);
        setCurrentIndex(aData.currentQuestionIndex);
        const answerMap: Record<string, number> = {};
        for (const a of aData.answers) {
          answerMap[a.questionId] = a.score;
        }
        setAnswers(answerMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assessment');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [assessmentId]);

  const debouncedProgressSave = useCallback(
    (index: number) => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      progressSaveTimer.current = setTimeout(() => {
        void updateProgress(assessmentId, index).catch(() => {});
      }, 500);
    },
    [assessmentId],
  );

  if (isLoading) {
    return (
      <div className="wizard-loading">
        <p>{isArabic ? 'جاري تحميل التقييم...' : 'Loading assessment...'}</p>
      </div>
    );
  }

  if (error || !questionsData || !assessment) {
    return (
      <div className="wizard-error">
        <p className="auth-feedback auth-feedback-error">{error || (isArabic ? 'خطأ في التحميل' : 'Loading error')}</p>
      </div>
    );
  }

  if (assessment.status === 'submitted') {
    return (
      <div className="wizard-submitted">
        <h2>{isArabic ? 'تم إرسال التقييم' : 'Assessment submitted'}</h2>
        <p>{isArabic ? 'تم إرسال هذا التقييم بالفعل.' : 'This assessment has already been submitted.'}</p>
      </div>
    );
  }

  const { questions, domains, answerOptions, totalQuestions } = questionsData;
  const question = questions[currentIndex];
  const domain = domains.find((d) => d.id === question.domain)!;
  const selectedScore = answers[question.id];
  const governanceCount = questions.filter((q) => q.domain === 'governance').length;
  const isLastGovernance = currentIndex === governanceCount - 1;
  const isLast = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;

  async function handleSelectAnswer(score: number) {
    setSaving(true);
    setError('');
    try {
      await saveAnswer(assessmentId, question.id, score);
      setAnswers((prev) => ({ ...prev, [question.id]: score }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (isLastGovernance && !showTransition) {
      setShowTransition(true);
      return;
    }
    if (isLast) {
      setShowConfirm(true);
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setShowTransition(false);
    debouncedProgressSave(next);
  }

  function handleBack() {
    if (showTransition) {
      setShowTransition(false);
      return;
    }
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      debouncedProgressSave(prev);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await submitAssessment(assessmentId);
      window.location.replace(`/assessment/${assessmentId}/results`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Domain transition screen
  if (showTransition) {
    const nextDomain = domains.find((d) => d.id === 'compliance')!;
    return (
      <div className="wizard-shell">
        <div className="wizard-progress">
          <div className="wizard-progress-bar">
            <div
              className="wizard-progress-fill"
              style={{ width: `${((governanceCount) / totalQuestions) * 100}%` }}
            />
          </div>
          <span className="wizard-progress-text">
            {governanceCount} / {totalQuestions}
          </span>
        </div>

        <div className="wizard-transition-card">
          <div className="wizard-transition-check">&#10003;</div>
          <h2>
            {isArabic
              ? `تم الانتهاء من ${domain.nameAr}`
              : `${domain.nameEn} complete`}
          </h2>
          <p>
            {isArabic
              ? `الآن ننتقل إلى المجال الثاني: ${nextDomain.nameAr}`
              : `Now starting Domain 2: ${nextDomain.nameEn}`}
          </p>
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={handleBack} type="button">
              {isArabic ? '→ رجوع' : '← Back'}
            </button>
            <button className="primary-btn" onClick={() => { setShowTransition(false); setCurrentIndex(governanceCount); debouncedProgressSave(governanceCount); }} type="button">
              {isArabic ? 'متابعة ←' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirm dialog
  if (showConfirm) {
    return (
      <div className="wizard-shell">
        <div className="wizard-transition-card">
          <h2>{isArabic ? 'تأكيد الإرسال' : 'Confirm submission'}</h2>
          <p>
            {isArabic
              ? `لقد أجبت على ${answeredCount} من ${totalQuestions} سؤال. هل تريد إرسال التقييم؟`
              : `You have answered ${answeredCount} of ${totalQuestions} questions. Submit the assessment?`}
          </p>
          {answeredCount < totalQuestions && (
            <p className="wizard-confirm-warning">
              {isArabic
                ? `تنبيه: لم تجب على جميع الأسئلة بعد.`
                : `Warning: Not all questions have been answered yet.`}
            </p>
          )}
          {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={() => setShowConfirm(false)} type="button">
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="primary-btn" onClick={handleSubmit} disabled={submitting} type="button">
              {submitting ? (isArabic ? 'جاري الإرسال...' : 'Submitting...') : (isArabic ? 'إرسال التقييم' : 'Submit assessment')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-shell">
      {/* Progress */}
      <div className="wizard-progress">
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
        <span className="wizard-progress-text">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* Domain badge */}
      <div className="wizard-domain-badge">
        {isArabic ? domain.nameAr : domain.nameEn}
      </div>

      {/* Question */}
      <div className="wizard-question-card">
        <span className="wizard-question-number">
          {isArabic ? `س${currentIndex + 1}` : `Q${currentIndex + 1}`}
        </span>
        <h2 className="wizard-question-text">
          {isArabic ? question.textAr : question.textEn}
        </h2>
      </div>

      {/* Answer options */}
      <div className="wizard-options">
        {answerOptions.map((option) => (
          <button
            key={option.score}
            className={`wizard-option ${selectedScore === option.score ? 'wizard-option-selected' : ''}`}
            onClick={() => handleSelectAnswer(option.score)}
            disabled={saving}
            type="button"
          >
            <span className="wizard-option-radio">
              {selectedScore === option.score ? '●' : '○'}
            </span>
            <span className="wizard-option-label">
              {isArabic ? option.labelAr : option.labelEn}
            </span>
            <span className="wizard-option-score">{option.score}</span>
          </button>
        ))}
      </div>

      {error && <p className="auth-feedback auth-feedback-error">{error}</p>}

      {/* Navigation */}
      <div className="wizard-nav">
        <button
          className="secondary-btn"
          onClick={handleBack}
          disabled={currentIndex === 0}
          type="button"
        >
          {isArabic ? '→ السابق' : '← Previous'}
        </button>
        <button
          className="primary-btn"
          onClick={handleNext}
          disabled={selectedScore === undefined}
          type="button"
        >
          {isLast
            ? (isArabic ? 'إرسال التقييم' : 'Submit assessment')
            : (isArabic ? 'التالي ←' : 'Next →')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/assessment-wizard.tsx
git commit -m "Add assessment wizard component with auto-save and navigation"
```

---

## Task 8: Assessment Pages

**Files:**
- Create: `apps/web/app/assessment/new/page.tsx`
- Create: `apps/web/app/assessment/[id]/page.tsx`

- [ ] **Step 1: Create the "start new assessment" page**

Create `apps/web/app/assessment/new/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createAssessment, listAssessments } from '../../../lib/assessment-client';
import { useLanguage } from '../../../components/language-provider';

export default function NewAssessmentPage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [error, setError] = useState('');

  useEffect(() => {
    async function start() {
      try {
        // Check for existing draft first
        const list = await listAssessments();
        const draft = list.find((a) => a.status === 'draft');

        if (draft) {
          window.location.replace(`/assessment/${draft.id}`);
          return;
        }

        const assessment = await createAssessment();
        window.location.replace(`/assessment/${assessment.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : isArabic ? 'فشل في بدء التقييم' : 'Failed to start assessment');
      }
    }
    void start();
  }, [isArabic]);

  if (error) {
    return (
      <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <p className="auth-feedback auth-feedback-error">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell auth-background-page" style={{ padding: '48px 0' }}>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'rgba(245,240,230,0.8)' }}>
          {isArabic ? 'جاري تحضير التقييم...' : 'Preparing assessment...'}
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the assessment wizard page**

Create `apps/web/app/assessment/[id]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { AssessmentWizard } from '../../../components/assessment-wizard';

export default function AssessmentPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <main className="page-shell auth-background-page wizard-background-page">
      <AssessmentWizard assessmentId={id} />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/assessment/new/page.tsx apps/web/app/assessment/[id]/page.tsx
git commit -m "Add assessment pages for new assessment and wizard view"
```

---

## Task 9: Wizard CSS

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Append wizard styles to globals.css**

Append to the end of `apps/web/app/globals.css`:

```css
/* --- M2: Assessment Wizard --- */
.wizard-background-page {
  padding: 24px 0 48px;
}

.wizard-shell {
  position: relative;
  z-index: 1;
  width: min(720px, calc(100% - 32px));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wizard-loading,
.wizard-error,
.wizard-submitted {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 48px 24px;
  color: rgba(245, 240, 230, 0.8);
}

.wizard-submitted h2 {
  color: var(--white);
  margin: 0 0 12px;
}

.wizard-progress {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wizard-progress-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.wizard-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--emerald), var(--sand));
  transition: width 0.4s ease;
}

.wizard-progress-text {
  font-size: 0.85rem;
  color: rgba(245, 240, 230, 0.65);
  white-space: nowrap;
  min-width: 56px;
  text-align: center;
}

.wizard-domain-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--mist);
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}

body[data-language='en'] .wizard-domain-badge {
  align-self: flex-start;
}

.wizard-question-card {
  border: 1px solid var(--border);
  border-radius: 28px;
  padding: 36px 32px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}

.wizard-question-number {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(216, 177, 108, 0.2), rgba(216, 177, 108, 0.08));
  border: 1px solid rgba(216, 177, 108, 0.18);
  color: var(--sand);
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.wizard-question-text {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.7;
  color: var(--white);
}

.wizard-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wizard-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 240, 230, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: inherit;
  font-size: 0.95rem;
  width: 100%;
}

.wizard-option:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
}

.wizard-option-selected {
  background: linear-gradient(135deg, rgba(216, 177, 108, 0.12), rgba(216, 177, 108, 0.04));
  border-color: rgba(216, 177, 108, 0.35);
  color: var(--white);
}

.wizard-option-radio {
  font-size: 1.1rem;
  color: rgba(216, 177, 108, 0.5);
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.wizard-option-selected .wizard-option-radio {
  color: var(--sand);
}

.wizard-option-label {
  flex: 1;
}

.wizard-option-score {
  font-size: 0.78rem;
  color: rgba(207, 227, 221, 0.4);
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.wizard-option-selected .wizard-option-score {
  color: var(--sand);
  background: rgba(216, 177, 108, 0.12);
}

.wizard-nav {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.wizard-nav .primary-btn:disabled,
.wizard-nav .secondary-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wizard-transition-card {
  border: 1px solid var(--border);
  border-radius: 28px;
  padding: 48px 36px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  text-align: center;
}

.wizard-transition-check {
  width: 56px;
  height: 56px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(15, 107, 91, 0.3), rgba(15, 107, 91, 0.1));
  border: 2px solid rgba(15, 107, 91, 0.4);
  color: var(--emerald);
  font-size: 1.4rem;
}

.wizard-transition-card h2 {
  margin: 0 0 10px;
  color: var(--white);
  font-size: 1.3rem;
}

.wizard-transition-card p {
  margin: 0 0 28px;
  color: rgba(245, 240, 230, 0.7);
  line-height: 1.7;
}

.wizard-confirm-warning {
  color: rgba(255, 200, 120, 0.9) !important;
  font-size: 0.9rem;
}

.wizard-transition-card .wizard-nav {
  justify-content: center;
}

@media (max-width: 600px) {
  .wizard-question-card {
    padding: 24px 20px;
  }

  .wizard-option {
    padding: 14px 16px;
    gap: 10px;
  }

  .wizard-question-text {
    font-size: 1.1rem;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "Add assessment wizard styles matching app theme"
```

---

## Task 10: End-to-End Smoke Test

- [ ] **Step 1: Get a fresh token**

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"ahmed@envco.sa","password":"SecurePass1"}' | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).accessToken))")
echo "Token: ${TOKEN:0:20}..."
```

- [ ] **Step 2: Delete any existing assessments for clean test**

```bash
cd "C:/Users/user/Desktop/Khedma/Personal projects/env-project/apps/api" && node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ host:'127.0.0.1', port:5433, user:'postgres', password:'postgres', database:'env_project' });
  await c.connect();
  await c.query('DELETE FROM assessment_answers');
  await c.query('DELETE FROM assessments');
  console.log('Assessment data cleared');
  await c.end();
})();
"
```

- [ ] **Step 3: Test full API flow**

```bash
# Create assessment
ASSESSMENT_ID=$(curl -s -X POST http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.error('Created:',j.status);process.stdout.write(j.id)})" 2>&1 1>/dev/null | head -1)
# Actually capture it properly:
RESPONSE=$(curl -s -X POST http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
ASSESSMENT_ID=$(echo "$RESPONSE" | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).id))")
echo "Assessment ID: $ASSESSMENT_ID"

# Save answers for all 18 questions
for q in GOV_01 GOV_02 GOV_03 GOV_04 GOV_05 GOV_06 GOV_07 GOV_08 GOV_09 COM_01 COM_02 COM_03 COM_04 COM_05 COM_06 COM_07 COM_08 COM_09; do
  curl -s -X PUT "http://localhost:4000/api/assessments/$ASSESSMENT_ID/answer" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"questionId\":\"$q\",\"score\":75}" > /dev/null
done
echo "All 18 answers saved"

# Verify answers
curl -s "http://localhost:4000/api/assessments/$ASSESSMENT_ID" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Answers:',j.answers.length,'Status:',j.status)})"

# Submit
curl -s -X POST "http://localhost:4000/api/assessments/$ASSESSMENT_ID/submit" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Submitted:',j.status,'At:',j.submittedAt)})"
```

Expected:
- Assessment ID printed
- "All 18 answers saved"
- "Answers: 18 Status: draft"
- "Submitted: submitted At: <timestamp>"

- [ ] **Step 4: Test duplicate draft prevention**

```bash
curl -s -X POST http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"
```

Expected: Should succeed (previous was submitted, no draft exists). Then try creating another:

```bash
curl -s -X POST http://localhost:4000/api/assessments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).message || 'Created OK'))"
```

Expected: "A draft assessment already exists for your organization"

- [ ] **Step 5: Test frontend wizard**

1. Open http://localhost:3000/assessment/new
2. Should redirect to the wizard page
3. Verify progress bar shows 1/18
4. Verify domain badge shows "Environmental Governance" (or Arabic)
5. Select an answer — should highlight with gold accent
6. Click Next — should advance to Q2
7. Click Back — should return to Q1 with answer preserved
8. Navigate to Q9 and click Next — should show domain transition screen
9. Click Continue — should show Q10 (compliance domain)

- [ ] **Step 6: Commit if fixes were needed**

```bash
git add -A
git commit -m "Fix any issues found during M2 smoke testing"
```

Only if changes were made during testing.
