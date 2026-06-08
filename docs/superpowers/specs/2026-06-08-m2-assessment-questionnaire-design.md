# M2 — Focused Assessment Questionnaire Design

## Overview

Build a wizard-style assessment questionnaire with 18 questions across 2 domains (Environmental Governance and Regulatory Compliance). One question per page, forward/back navigation, progress bar, auto-save on answer selection, and resume support for unfinished assessments.

## Database Schema

### New table: `assessments`

```sql
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  current_question_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS assessments_entity_id_idx ON assessments (entity_id);
CREATE INDEX IF NOT EXISTS assessments_status_idx ON assessments (status);
```

Status values: `draft` (in progress), `submitted` (completed and scored).

Only one `draft` assessment per entity is allowed at a time. A new assessment can only be started if no draft exists for that entity.

### New table: `assessment_answers`

```sql
CREATE TABLE IF NOT EXISTS assessment_answers (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id VARCHAR(20) NOT NULL,
  score INT NOT NULL CHECK (score IN (0, 25, 50, 75, 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS assessment_answers_assessment_id_idx ON assessment_answers (assessment_id);
```

The UNIQUE constraint on `(assessment_id, question_id)` ensures one answer per question per assessment. Saving an answer uses INSERT ... ON CONFLICT UPDATE.

## Questions Definition

Questions are defined in code, not in a database table. This makes them easy to version, review, and swap when the client provides final text.

File: `apps/api/src/assessment/questions.ts`

### Structure

```typescript
interface AnswerOption {
  score: number;
  labelAr: string;
  labelEn: string;
}

interface Question {
  id: string;           // e.g. 'GOV_01', 'COM_05'
  domain: 'governance' | 'compliance';
  textAr: string;
  textEn: string;
  helpAr?: string;      // optional clarification text
  helpEn?: string;
}

interface Domain {
  id: 'governance' | 'compliance';
  nameAr: string;
  nameEn: string;
  weight: number;       // 0.45 or 0.55
}
```

### Domains

| ID | Arabic | English | Weight |
|----|--------|---------|--------|
| governance | الحوكمة البيئية | Environmental Governance | 0.45 |
| compliance | الامتثال التنظيمي | Regulatory Compliance | 0.55 |

### Answer Options (same for all questions)

| Score | Arabic | English |
|-------|--------|---------|
| 0 | لا يوجد | Does not exist |
| 25 | في مرحلة التخطيط | In planning stage |
| 50 | مطبّق جزئيًا | Partially implemented |
| 75 | مطبّق بشكل كبير | Largely implemented |
| 100 | مطبّق بالكامل ومُراجَع دوريًا | Fully implemented and periodically reviewed |

### Draft Questions

#### Domain 1: Environmental Governance (الحوكمة البيئية) — 9 questions

| ID | English | Arabic |
|----|---------|--------|
| GOV_01 | Does your organization have a documented and approved environmental policy? | هل لدى منشأتكم سياسة بيئية موثقة ومعتمدة؟ |
| GOV_02 | Is there a dedicated environmental management team or officer? | هل يوجد فريق أو مسؤول مختص بالإدارة البيئية؟ |
| GOV_03 | Are environmental objectives integrated into the organization's strategic planning? | هل تم دمج الأهداف البيئية في التخطيط الاستراتيجي للمنشأة؟ |
| GOV_04 | Does the board or senior leadership provide oversight on environmental matters? | هل يقوم مجلس الإدارة أو القيادة العليا بالإشراف على الشؤون البيئية؟ |
| GOV_05 | Is there a dedicated budget allocated for environmental programs and compliance? | هل توجد ميزانية مخصصة للبرامج البيئية والامتثال؟ |
| GOV_06 | Does the organization provide environmental awareness training for employees? | هل توفر المنشأة برامج تدريب وتوعية بيئية للموظفين؟ |
| GOV_07 | Is there a process for engaging stakeholders on environmental issues? | هل توجد آلية لإشراك أصحاب المصلحة في القضايا البيئية؟ |
| GOV_08 | Does the organization conduct internal environmental audits? | هل تجري المنشأة عمليات تدقيق بيئي داخلية؟ |
| GOV_09 | Are environmental KPIs tracked and reported to management? | هل يتم تتبع مؤشرات الأداء البيئي ورفعها للإدارة؟ |

#### Domain 2: Regulatory Compliance (الامتثال التنظيمي) — 9 questions

| ID | English | Arabic |
|----|---------|--------|
| COM_01 | Does your organization hold all required NCEC environmental licenses and permits? | هل تمتلك منشأتكم جميع التراخيص والتصاريح البيئية المطلوبة من المركز الوطني للرقابة البيئية؟ |
| COM_02 | Is the organization compliant with MEWA water and wastewater regulations? | هل تلتزم المنشأة بأنظمة وزارة البيئة والمياه والزراعة المتعلقة بالمياه والصرف؟ |
| COM_03 | Does the organization conduct environmental impact assessments for new projects? | هل تجري المنشأة تقييمات الأثر البيئي للمشاريع الجديدة؟ |
| COM_04 | Is there a documented waste management system compliant with regulatory requirements? | هل يوجد نظام إدارة نفايات موثق ومتوافق مع المتطلبات التنظيمية؟ |
| COM_05 | Does the organization monitor and report air emissions as required by regulations? | هل تراقب المنشأة انبعاثاتها الهوائية وتبلغ عنها وفقًا للأنظمة؟ |
| COM_06 | Are hazardous materials handled, stored, and disposed of according to regulations? | هل يتم التعامل مع المواد الخطرة وتخزينها والتخلص منها وفقًا للأنظمة؟ |
| COM_07 | Has the organization adopted ISO 14001 or an equivalent environmental management system? | هل تبنت المنشأة نظام إدارة بيئية ISO 14001 أو ما يعادله؟ |
| COM_08 | Is the organization prepared for regulatory inspections at any time? | هل المنشأة مستعدة للتفتيش التنظيمي في أي وقت؟ |
| COM_09 | Are there documented procedures for reporting environmental incidents? | هل توجد إجراءات موثقة للإبلاغ عن الحوادث البيئية؟ |

These are realistic draft questions. The client can swap the exact text — the IDs and structure remain the same.

## API Endpoints

All endpoints require JWT authentication.

### POST /api/assessments

Create a new draft assessment for the current user's entity.

Request: no body needed (entity_id derived from authenticated user).

Logic:
1. Check no existing `draft` assessment for this entity
2. Create assessment with `status: 'draft'`, `current_question_index: 0`
3. Return the created assessment

Response:
```json
{
  "id": "uuid",
  "entityId": "uuid",
  "userId": "uuid",
  "status": "draft",
  "currentQuestionIndex": 0,
  "createdAt": "...",
  "submittedAt": null,
  "answers": []
}
```

### GET /api/assessments

List all assessments for the current user's entity.

Response:
```json
[
  {
    "id": "uuid",
    "entityId": "uuid",
    "userId": "uuid",
    "status": "draft",
    "currentQuestionIndex": 5,
    "createdAt": "...",
    "submittedAt": null,
    "answeredCount": 5,
    "totalQuestions": 18
  }
]
```

### GET /api/assessments/:id

Get assessment with all saved answers. Only accessible by users in the same entity.

Response:
```json
{
  "id": "uuid",
  "entityId": "uuid",
  "userId": "uuid",
  "status": "draft",
  "currentQuestionIndex": 5,
  "createdAt": "...",
  "submittedAt": null,
  "answers": [
    { "questionId": "GOV_01", "score": 75 },
    { "questionId": "GOV_02", "score": 50 }
  ]
}
```

### PUT /api/assessments/:id/answer

Save or update a single answer. Only allowed when status is `draft`.

Request:
```json
{
  "questionId": "GOV_01",
  "score": 75
}
```

Logic:
1. Validate assessment exists, belongs to user's entity, and is `draft`
2. Validate `questionId` exists in the questions definition
3. Validate `score` is one of [0, 25, 50, 75, 100]
4. INSERT ... ON CONFLICT (assessment_id, question_id) UPDATE score, updated_at

Response: `{ "questionId": "GOV_01", "score": 75 }`

### PUT /api/assessments/:id/progress

Update the current question index (for resume). Only when `draft`.

Request:
```json
{
  "currentQuestionIndex": 5
}
```

### POST /api/assessments/:id/submit

Submit the assessment. Only when all 18 questions are answered and status is `draft`.

Logic:
1. Validate all 18 questions have answers
2. Set `status = 'submitted'` and `submitted_at = NOW()`
3. Return the submitted assessment with answers

Response: same as GET /api/assessments/:id but with `status: "submitted"`.

Scoring (M3) will be triggered from the frontend after successful submit.

## Frontend

### New pages

- `/assessment/new` — Calls POST /api/assessments, redirects to `/assessment/[id]`
- `/assessment/[id]` — The wizard page

### Wizard page layout

```
┌──────────────────────────────────────────────┐
│  Progress bar: ████████░░░░░░░░  5 of 18     │
│  Domain: Environmental Governance             │
├──────────────────────────────────────────────┤
│                                              │
│  Q5. Does the organization provide           │
│      environmental awareness training         │
│      for employees?                          │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │ ○  Does not exist              (0)  │     │
│  ├─────────────────────────────────────┤     │
│  │ ○  In planning stage          (25)  │     │
│  ├─────────────────────────────────────┤     │
│  │ ● Partially implemented       (50)  │ ←── │
│  ├─────────────────────────────────────┤     │
│  │ ○  Largely implemented        (75)  │     │
│  ├─────────────────────────────────────┤     │
│  │ ○  Fully implemented & reviewed(100)│     │
│  └─────────────────────────────────────┘     │
│                                              │
│           [← Back]         [Next →]          │
└──────────────────────────────────────────────┘
```

- Progress bar shows question X of 18 with filled/unfilled segments
- Domain label changes from governance to compliance at question 10
- Answer options are large clickable cards (radio-style, one selected)
- Selected answer highlighted with sand/gold accent
- Back button disabled on question 1
- Next button disabled until an answer is selected (or already answered)
- Last question shows "Submit" instead of "Next"
- On submit: confirmation dialog, then POST /submit, redirect to results

### Domain transition

Between question 9 and 10, show a brief transition card:
> "Domain 1 complete. Now starting Domain 2: Regulatory Compliance (الامتثال التنظيمي)"
> [Continue →]

### Auto-save behavior

- When user selects an answer, immediately PUT /answer to save it
- Also PUT /progress with current index on each navigation
- On page load, GET /assessment/:id to restore all saved answers and resume position
- No explicit "Save" button needed

### Resume flow

- If user navigates away and returns, GET /assessment/:id loads saved answers
- Wizard starts at `currentQuestionIndex` (last viewed question)
- All previously answered questions show their saved selection

### Assessment list

On the account page or a new `/assessments` page, show a card/button:
- If draft exists: "Continue Assessment (X/18 answered)" → links to wizard
- If no draft: "Start New Assessment" → links to /assessment/new
- Past submitted assessments listed below

## Files to Create/Modify

### API (apps/api/src/)
- `assessment/assessment.module.ts` — new module
- `assessment/assessment.controller.ts` — REST endpoints
- `assessment/assessment.service.ts` — business logic
- `assessment/questions.ts` — question definitions (18 questions, domains, answer options)
- `assessment/dto/save-answer.dto.ts` — validation for answer save
- `assessment/dto/update-progress.dto.ts` — validation for progress update
- `database/database.service.ts` — add `ensureAssessmentsTable()` and `ensureAssessmentAnswersTable()`
- `app.module.ts` — import AssessmentModule

### Web (apps/web/)
- `lib/assessment-client.ts` — API client functions for assessments
- `app/assessment/new/page.tsx` — start new assessment page
- `app/assessment/[id]/page.tsx` — wizard page
- `components/assessment-wizard.tsx` — the wizard component
- `components/assessment-progress.tsx` — progress bar component
- `app/globals.css` — wizard styles matching the app theme

## Out of Scope

- Scoring calculation (M3)
- Results dashboard (M4)
- Recommendations (M5)
- Multiple assessments comparison
- Question branching/conditional logic
- File attachments on answers
- Timer/time tracking
