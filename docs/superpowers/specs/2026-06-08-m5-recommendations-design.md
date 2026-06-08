# M5 — Rule-based Recommendations Design

## Overview

Generate 3 recommendations based on the weakest-scoring answers in a submitted assessment. Recommendations are computed on-the-fly (not stored in DB). Each question has a pre-written recommendation with action, expected impact, and legal/regulatory reference in both Arabic and English.

## Recommendation Data

File: `apps/api/src/assessment/recommendations.ts`

Each of the 18 questions maps to a recommendation entry:

```typescript
interface RecommendationRule {
  questionId: string;
  actionAr: string;
  actionEn: string;
  impactAr: string;
  impactEn: string;
  referenceAr: string;
  referenceEn: string;
}
```

### Recommendation Rules (all 18)

#### Governance (GOV_01 – GOV_09)

| ID | Action (EN) | Impact (EN) | Reference |
|----|-------------|-------------|-----------|
| GOV_01 | Develop and approve a comprehensive documented environmental policy | Establishes the foundation for all environmental practices and ensures leadership commitment | ISO 14001:2015 — Clause 5.2 |
| GOV_02 | Appoint a dedicated environmental officer or establish an environmental management team | Ensures accountability and focused expertise for environmental matters | ISO 14001:2015 — Clause 5.3 |
| GOV_03 | Integrate environmental objectives into the organization's strategic plan | Aligns environmental goals with business strategy, improving resource allocation | ISO 14001:2015 — Clause 6.2 |
| GOV_04 | Establish board-level or senior leadership oversight for environmental performance | Drives top-down commitment and ensures environmental issues receive executive attention | ISO 14001:2015 — Clause 5.1 |
| GOV_05 | Allocate a dedicated annual budget for environmental programs and compliance activities | Enables proactive environmental management rather than reactive compliance | Saudi Vision 2030 — Environmental Sustainability |
| GOV_06 | Implement regular environmental awareness and training programs for all employees | Builds organization-wide environmental culture and reduces compliance violations | ISO 14001:2015 — Clause 7.2, 7.3 |
| GOV_07 | Create a stakeholder engagement process for environmental issues | Improves transparency, builds trust, and identifies environmental risks early | ISO 14001:2015 — Clause 4.2 |
| GOV_08 | Establish a formal internal environmental audit program | Identifies non-conformities before they become regulatory violations | ISO 14001:2015 — Clause 9.2 |
| GOV_09 | Define and track environmental KPIs with regular management reporting | Enables data-driven decision making and demonstrates continuous improvement | ISO 14001:2015 — Clause 9.1 |

#### Compliance (COM_01 – COM_09)

| ID | Action (EN) | Impact (EN) | Reference |
|----|-------------|-------------|-----------|
| COM_01 | Obtain all required NCEC environmental licenses and ensure timely renewal | Prevents operational shutdowns and regulatory penalties | NCEC Environmental Licensing Regulations |
| COM_02 | Conduct a water and wastewater compliance audit against MEWA regulations | Ensures legal compliance and reduces risk of water resource violations | MEWA Water and Wastewater Regulations |
| COM_03 | Implement environmental impact assessment procedures for all new projects | Prevents costly remediation and ensures regulatory approval for new activities | Saudi Environmental Impact Assessment Regulations |
| COM_04 | Develop a documented waste management system covering classification, handling, and disposal | Reduces environmental liability and ensures proper waste tracking | Saudi Waste Management Regulations — NCEC |
| COM_05 | Install air emissions monitoring equipment and establish regular reporting procedures | Ensures compliance with air quality standards and avoids penalties | NCEC Air Quality Standards and Emissions Regulations |
| COM_06 | Review and update hazardous materials handling, storage, and disposal procedures | Prevents environmental contamination and ensures worker safety | NCEC Hazardous Materials Management Regulations |
| COM_07 | Begin ISO 14001 implementation or adopt an equivalent environmental management system | Provides a systematic framework for managing environmental responsibilities | ISO 14001:2015 — Full Standard |
| COM_08 | Conduct mock regulatory inspections and maintain inspection-ready documentation | Reduces risk of non-compliance findings during actual inspections | NCEC Inspection and Enforcement Procedures |
| COM_09 | Develop and document environmental incident reporting and response procedures | Ensures timely response to incidents and meets regulatory notification requirements | NCEC Environmental Incident Reporting Regulations |

Each rule also has full Arabic translations for actionAr, impactAr, and referenceAr.

## Selection Logic

Pure function `generateRecommendations(answers, questions)`:

1. Filter to only answered questions (score exists)
2. Sort answers by score ascending (lowest first)
3. On tie scores, prefer compliance questions over governance (compliance has higher weight 55% vs 45%)
4. Take the bottom 3
5. Map each to its recommendation rule + include the question text and score
6. Assign rank 1, 2, 3

Returns array of 3 recommendation objects.

## API

### GET /api/assessments/:id/recommendations

Authenticated. Only for submitted assessments belonging to the user's entity.

Response:
```json
[
  {
    "rank": 1,
    "questionId": "COM_05",
    "score": 0,
    "questionTextAr": "هل تراقب المنشأة انبعاثاتها الهوائية...",
    "questionTextEn": "Does the organization monitor and report air emissions...",
    "actionAr": "تركيب أجهزة مراقبة الانبعاثات الهوائية...",
    "actionEn": "Install air emissions monitoring equipment...",
    "impactAr": "يضمن الامتثال لمعايير جودة الهواء...",
    "impactEn": "Ensures compliance with air quality standards...",
    "referenceAr": "أنظمة المركز الوطني للرقابة البيئية لجودة الهواء والانبعاثات",
    "referenceEn": "NCEC Air Quality Standards and Emissions Regulations"
  },
  { "rank": 2, ... },
  { "rank": 3, ... }
]
```

Returns empty array if assessment is not submitted or has no answers.

## Frontend

Add a **Recommendations section** to the existing results dashboard (`components/results-dashboard.tsx`), below the domain cards.

### Layout

```
## التوصيات / Recommendations

┌─────────────────────────────────────────────┐
│  ① Rank 1 — Highest Priority               │
│                                             │
│  Question: [original question text]         │
│  Your score: 0 / 100                        │
│                                             │
│  📋 Action: [recommended action]             │
│  📈 Impact: [expected impact]                │
│  📖 Reference: [legal/regulatory source]     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ② Rank 2                                   │
│  ...                                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ③ Rank 3                                   │
│  ...                                        │
└─────────────────────────────────────────────┘
```

Each card is a glass card matching the app theme. Rank badge uses the sand/gold accent. Question score shown with a small colored indicator (red for 0, orange for 25, etc.).

## Files to Create/Modify

### API
- `apps/api/src/assessment/recommendations.ts` — new file: recommendation rules data + `generateRecommendations()` function
- `apps/api/src/assessment/assessment.service.ts` — add `getRecommendations()` method
- `apps/api/src/assessment/assessment.controller.ts` — add `GET /:id/recommendations` endpoint

### Web
- `apps/web/lib/assessment-client.ts` — add `Recommendation` type and `fetchRecommendations()` function
- `apps/web/components/results-dashboard.tsx` — add recommendations section
- `apps/web/app/globals.css` — recommendation card styles

## Out of Scope

- AI-generated recommendations (Release 3+)
- Storing recommendations in DB
- Custom recommendation rules per entity/sector
- Action tracking / checkbox completion
