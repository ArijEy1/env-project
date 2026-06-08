# M3 — Server-side Scoring Engine Design

## Overview

Calculate maturity scores when an assessment is submitted. Pure server-side logic to prevent manipulation. Scores stored directly on the assessment row. No new endpoints — hooks into the existing submit flow.

## Database Changes

Add 4 columns to the existing `assessments` table:

```sql
ALTER TABLE assessments
  ADD COLUMN total_score DECIMAL(5,2),
  ADD COLUMN governance_score DECIMAL(5,2),
  ADD COLUMN compliance_score DECIMAL(5,2),
  ADD COLUMN maturity_level INT;
```

Since this is early dev with no production data, we modify the `ensureAssessmentsTable()` CREATE TABLE statement to include these columns from the start.

All 4 columns are NULL for `draft` assessments and populated on submit.

## Scoring Formula

```
governance_answers = answers where question.domain === 'governance'
compliance_answers = answers where question.domain === 'compliance'

governance_avg = sum(governance_answer_scores) / governance_question_count
compliance_avg = sum(compliance_answer_scores) / compliance_question_count

total_score = (governance_avg × 0.45) + (compliance_avg × 0.55)
```

Domain weights come from `DOMAINS` in `questions.ts`: governance = 0.45, compliance = 0.55.

Scores are stored as DECIMAL(5,2) to preserve precision (e.g., 67.50, not 68).

## Maturity Levels

| Level | Range | Arabic | English |
|-------|-------|--------|---------|
| 1 | 0.00 – 20.00 | مبتدئ | Beginning |
| 2 | 20.01 – 40.00 | أساسي | Basic |
| 3 | 40.01 – 60.00 | متوسط | Intermediate |
| 4 | 60.01 – 80.00 | متقدم | Advanced |
| 5 | 80.01 – 100.00 | رائد | Leading |

Boundary rule: a score of exactly 20.00 is Level 1, a score of 20.01 is Level 2. Implementation uses `Math.ceil(totalScore / 20)` clamped to 1-5, with a special case for 0 → Level 1.

## Scoring Module

File: `apps/api/src/assessment/scoring.ts`

Pure function, no dependencies on NestJS or DB:

```typescript
interface ScoreInput {
  questionId: string;
  score: number;
}

interface ScoreResult {
  totalScore: number;
  governanceScore: number;
  complianceScore: number;
  maturityLevel: number;
}

function calculateScore(answers: ScoreInput[], questions: Question[], domains: Domain[]): ScoreResult
```

This function:
1. Groups answers by domain using the questions definition
2. Calculates average score per domain
3. Applies domain weights to get total score
4. Derives maturity level
5. Returns all 4 values rounded to 2 decimal places

## Integration with Submit Flow

In `AssessmentService.submit()`, after validating all 18 answers exist:

1. Fetch all answers from DB
2. Call `calculateScore(answers, QUESTIONS, DOMAINS)`
3. UPDATE assessments SET total_score, governance_score, compliance_score, maturity_level, status='submitted', submitted_at=NOW()
4. Return the assessment with scores

## API Response Changes

All assessment responses (`getById`, `list`, `submit`) include 4 new fields:

```json
{
  "id": "uuid",
  "status": "submitted",
  "totalScore": 67.50,
  "governanceScore": 63.89,
  "complianceScore": 70.44,
  "maturityLevel": 4,
  ...
}
```

For `draft` assessments: `totalScore`, `governanceScore`, `complianceScore`, and `maturityLevel` are all `null`.

The `list` endpoint also includes these fields so the assessment list can show scores without fetching each assessment individually.

## Frontend Type Changes

Update `Assessment` and `AssessmentListItem` interfaces in `apps/web/lib/assessment-client.ts` to include the 4 new nullable fields.

## Files to Create/Modify

### API
- `apps/api/src/assessment/scoring.ts` — new file, pure scoring function
- `apps/api/src/assessment/assessment.service.ts` — integrate scoring into submit, add score fields to responses
- `apps/api/src/database/database.service.ts` — add score columns to assessments table

### Web
- `apps/web/lib/assessment-client.ts` — add score fields to types

## Out of Scope

- Results dashboard visualization (M4)
- Recommendations (M5)
- Re-scoring submitted assessments
- Score history / trends
