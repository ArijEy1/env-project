# M4 — Results Dashboard Design

## Overview

Frontend-only results page shown after assessment submission. Displays total score as an SVG donut chart, maturity level badge, and domain score cards with horizontal bar fills. Pure SVG/CSS — no chart library dependencies. Matches the app's dark glassmorphism theme.

## Page

`/assessment/[id]/results` — accessible after submit redirect and from assessment history.

If the assessment is still `draft`, redirect to the wizard (`/assessment/[id]`).

## Data Source

No new API endpoints. Uses existing `GET /api/assessments/:id` which returns:
- `totalScore` (0-100, 2 decimal places)
- `governanceScore` (0-100)
- `complianceScore` (0-100)
- `maturityLevel` (1-5)
- `status` ('draft' | 'submitted')
- `submittedAt` (ISO timestamp)

Entity name comes from `GET /api/auth/me` (user.entity.nameAr / nameEn).

## Layout

```
┌──────────────────────────────────────────────────┐
│  Header: "نتائج التقييم" / "Assessment Results"  │
│  Entity name · Submission date                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │     SVG Donut          Maturity      │        │
│  │    ┌───────┐           Level 4       │        │
│  │    │ 61.25 │           متقدم        │        │
│  │    │ / 100 │           Advanced      │        │
│  │    └───────┘                         │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  ┌─────────────────┐  ┌─────────────────┐        │
│  │  الحوكمة البيئية │  │  الامتثال التنظيمي│       │
│  │  75.00 / 100     │  │  50.00 / 100    │        │
│  │  ████████░░ 75%  │  │  █████░░░░ 50%  │        │
│  │  الوزن: 45%      │  │  الوزن: 55%     │        │
│  └─────────────────┘  └─────────────────┘        │
│                                                  │
│  [← العودة للحساب]     [تحميل PDF] (معطل)         │
└──────────────────────────────────────────────────┘
```

## Components

### ScoreDonut (`components/score-donut.tsx`)

Pure SVG donut chart component.

Props:
- `score: number` (0-100)
- `size?: number` (default 180)
- `maturityLevel: number` (1-5, determines ring color)

Renders:
- Circular SVG with a background ring (dark/transparent) and a foreground arc proportional to score
- Score number centered inside (large, bold)
- "/100" label below the score
- Arc color based on maturity level

SVG technique: `stroke-dasharray` and `stroke-dashoffset` on a circle element. The ring is a circle with thick stroke, no fill. The foreground arc uses dasharray = circumference, dashoffset = circumference × (1 - score/100).

### DomainScoreCard (inline in results-dashboard.tsx)

Not a separate component — rendered inline since it's just a div with a bar.

Shows:
- Domain name (AR/EN)
- Score: `XX.XX / 100`
- Horizontal bar fill (width = score%)
- Weight label: `الوزن: 45%` / `Weight: 45%`

Bar fill uses the same gradient as the progress bar (emerald → sand).

### MaturityBadge (inline in results-dashboard.tsx)

Shows:
- Level number in a colored circle
- Level label (AR/EN)
- Color from the maturity level color map

### ResultsDashboard (`components/results-dashboard.tsx`)

Main component. Receives `assessmentId` prop.

On mount:
1. Fetch assessment via `getAssessment(id)`
2. Fetch user profile via `fetchProfile(token)` for entity name
3. If status is `draft`, redirect to `/assessment/[id]`
4. Render the dashboard layout

## Maturity Level Colors

| Level | Color | AR | EN |
|-------|-------|----|----|
| 1 | #E24B4A | مبتدئ | Beginning |
| 2 | #EF9F27 | أساسي | Basic |
| 3 | #ADD378 | متوسط | Intermediate |
| 4 | #5DCAA5 | متقدم | Advanced |
| 5 | #0FE656 | رائد | Leading |

## Styling

All components use the app's glassmorphism theme:
- Glass cards with `rgba(255,255,255,0.08)` background, blur, border
- White text on dark background
- Sand/gold accents for highlights
- Domain bar fills use the emerald→sand gradient

## Files to Create/Modify

- `apps/web/app/assessment/[id]/results/page.tsx` — page wrapper
- `apps/web/components/results-dashboard.tsx` — main dashboard with domain cards and maturity badge
- `apps/web/components/score-donut.tsx` — SVG donut chart
- `apps/web/app/globals.css` — dashboard styles

## Out of Scope

- PDF download (M6)
- Recommendations section (M5)
- Historical comparison / trends
- Print styling
