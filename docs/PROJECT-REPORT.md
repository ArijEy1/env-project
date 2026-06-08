# Environmental Compliance Maturity Tool — Project Report

## Executive Summary

A fully functional MVP of the National Environmental Compliance Maturity Tool has been built. The platform allows Saudi organizations to register, complete an 18-question environmental maturity assessment across two domains, receive a scored result with maturity level classification, view recommendations, and download a professional Arabic PDF report. A platform admin panel provides oversight of all entities and assessments.

**Built in a single session** — 80 commits, 75 source files, ~6,900 lines of code.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | NestJS (Node.js + TypeScript) |
| **Frontend** | Next.js 15 (React 19 + TypeScript) |
| **Database** | PostgreSQL 18 |
| **PDF Generation** | PDFKit with embedded Noto Sans Arabic fonts |
| **Authentication** | JWT + Passport.js |
| **Password Hashing** | scrypt (timing-safe) |
| **Styling** | Custom CSS (glassmorphism theme, no framework) |
| **Architecture** | npm workspaces monorepo (`apps/api` + `apps/web`) |

---

## Features Delivered

### M1 — Authentication & Entity Profile
- **Email/password registration** with nested organization + user creation
- **JWT login** with Bearer token authentication
- **Password reset** via email (SMTP/Mailtrap) with secure token flow
- **Entity (organization) profiles**: name AR/EN, CR number, sector, city, region, employee count, contact info, unified national number
- **User profiles**: first/last name, email, phone, job role, role (admin/user/superadmin)
- **Brute-force protection**: in-memory rate limiter, 5 failed attempts = 15-minute lockout
- **Profile editing**: inline edit for user profile and entity details (admin only)
- **Password policy**: minimum 8 characters, requires uppercase + lowercase + digit

### M2 — Focused Assessment Questionnaire
- **18 bilingual questions** across 2 domains:
  - Environmental Governance (9 questions) — 45% weight
  - Regulatory Compliance (9 questions) — 55% weight
- **Wizard-style UI**: one question per page, progress bar, domain badge
- **5-point answer scale**: 0 (Does not exist) → 25 (Planning) → 50 (Partially) → 75 (Largely) → 100 (Fully implemented)
- **Forward/back navigation** with answer preservation
- **Domain transition screen** between governance and compliance sections
- **Confirmation dialog** before final submission
- **One draft per entity** enforcement

### M3 — Server-side Scoring Engine
- **Weighted formula**: `(governance_avg × 0.45) + (compliance_avg × 0.55)`
- **Maturity levels 1-5**: Beginning (0-20), Basic (21-40), Intermediate (41-60), Advanced (61-80), Leading (81-100)
- **Calculated server-side** at submit time to prevent manipulation
- **Scores stored** on the assessment row (total, governance, compliance, maturity level)

### M4 — Results Dashboard
- **SVG donut chart** showing total score with color-coded maturity ring
- **Maturity level badge** with level number, label (AR/EN), and color
- **Domain score cards** with horizontal bar fills and weight percentages
- **Responsive layout** with mobile breakpoint
- **No chart library dependencies** — pure SVG/CSS

### M5 — Rule-based Recommendations
- **3 recommendations** based on the weakest-scoring answers
- Each includes: recommended action, expected impact, legal/regulatory reference
- **All 18 questions** have pre-written bilingual recommendation rules
- **Tie-breaking**: compliance questions preferred (higher weight)
- **Computed on-the-fly** from answers (not stored in DB)
- **References**: ISO 14001, NCEC regulations, MEWA regulations, Saudi EIA regulations

### M6 — Professional PDF Report
- **2-page A4 Arabic PDF** generated server-side with PDFKit
- **Page 1**: Header with app title, entity name, submission date, reference number, total score, maturity level, domain scores, methodology
- **Page 2**: Top 3 recommendations with action, impact, and legal reference
- **Noto Sans Arabic** font embedded for proper Arabic rendering
- **Unique reference number**: `ENV-YYYY-NNNNNN` format
- **Download** via authenticated blob fetch (no token in URL)

### M7 — Arabic RTL Interface
- **Noto Sans Arabic** font loaded via `next/font/google` (400/600/700 weights)
- **Arabic-first RTL** layout with `dir="rtl"` and `direction: rtl`
- **English LTR** toggle with full language switching
- **Arabic error translation**: 28 exact matches + 9 regex patterns for API validation messages
- **Bilingual labels** on every form, button, heading, and UI element
- **Font ligatures** and smoothing for Arabic text

### M8 — Autosave & Continuity
- **Auto-save on answer selection** — immediate API call
- **localStorage fallback** — if API save fails, answers cached locally and synced on reconnect
- **Save indicator**: "Saving..." / "Saved" / "Save failed — saved locally"
- **Resume support**: loads saved answers and position on page reload
- **Assessment card on account page**: shows draft progress bar with "Continue Assessment" or "Start New Assessment"
- **Assessment history**: list of submitted assessments with scores and links to results

### Admin Panel
- **Platform superadmin role** — separate from entity admin, sees everything
- **Dashboard**: stats cards (total entities, users, assessments, average score)
- **Entities list**: all organizations with sector, city, user count, assessment count
- **Assessments list**: all assessments with entity name, status, score, maturity level, date
- **PDF download** for any submitted assessment
- **Results link** to view any assessment's results page
- **Search bar**: filter by name, CR number, entity, or user
- **Filters**: sector, city, status, maturity level with clear button
- **Seed script**: create first superadmin via CLI
- **SuperAdmin guard**: 403 for non-superadmin access

### Cross-cutting Features
- **Toast notifications**: success (green), error (red), info (teal) — top-right, auto-dismiss 4 seconds
- **Responsive design**: mobile breakpoints throughout
- **Dark glassmorphism theme**: teal/emerald gradients, translucent cards, blur effects, sand/gold accents
- **Maturity level color coding**: red → orange → lime → teal → green (consistent across dashboard, admin, PDF)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `entities` | Organizations (name AR/EN, CR number, sector, city, etc.) |
| `users` | User accounts (name, email, password, role, entity FK) |
| `password_reset_tokens` | Secure password reset flow |
| `assessments` | Assessment instances (status, scores, maturity level) |
| `assessment_answers` | Individual answers (question ID, score 0-100) |

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register entity + user |
| POST | /auth/login | Login, returns JWT |
| POST | /auth/forgot-password | Request password reset email |
| POST | /auth/reset-password | Reset password with token |
| GET | /auth/me | Get current user + entity |
| PUT | /auth/profile | Update user profile |
| PUT | /auth/entity | Update entity (admin only) |

### Assessments (`/api/assessments`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /assessments | Create new draft |
| GET | /assessments | List entity's assessments |
| GET | /assessments/questions | Get question definitions |
| GET | /assessments/:id | Get assessment with answers |
| PUT | /assessments/:id/answer | Save/update an answer |
| PUT | /assessments/:id/progress | Update current question index |
| POST | /assessments/:id/submit | Submit assessment (triggers scoring) |
| GET | /assessments/:id/recommendations | Get 3 recommendations |
| GET | /assessments/:id/report | Download PDF report |

### Admin (`/api/admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/stats | Platform statistics |
| GET | /admin/entities | All entities with counts |
| GET | /admin/entities/:id | Entity detail with users |
| GET | /admin/assessments | All assessments |
| GET | /admin/assessments/:id | Assessment detail |
| GET | /admin/assessments/:id/report | Download any PDF |

---

## Project Structure

```
env-project/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── assets/fonts/             # Noto Sans Arabic TTF
│   │   ├── src/
│   │   │   ├── admin/                # Admin panel module
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── admin.module.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   ├── seed-admin.ts
│   │   │   │   └── superadmin.guard.ts
│   │   │   ├── assessment/           # Assessment module
│   │   │   │   ├── assessment.controller.ts
│   │   │   │   ├── assessment.module.ts
│   │   │   │   ├── assessment.service.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── pdf-report.ts
│   │   │   │   ├── questions.ts
│   │   │   │   ├── recommendations.ts
│   │   │   │   └── scoring.ts
│   │   │   ├── auth/                 # Auth module
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth-email.service.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── entities/
│   │   │   │   ├── interfaces/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── login-rate-limiter.ts
│   │   │   ├── database/             # Database module
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── package.json
│   └── web/                          # Next.js Frontend
│       ├── app/
│       │   ├── account/page.tsx
│       │   ├── admin/
│       │   │   ├── page.tsx
│       │   │   ├── assessments/page.tsx
│       │   │   └── entities/page.tsx
│       │   ├── assessment/
│       │   │   ├── new/page.tsx
│       │   │   └── [id]/
│       │   │       ├── page.tsx
│       │   │       └── results/page.tsx
│       │   ├── forgot-password/page.tsx
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   ├── reset-password/page.tsx
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── account-panel.tsx
│       │   ├── admin-layout.tsx
│       │   ├── assessment-wizard.tsx
│       │   ├── auth-form.tsx
│       │   ├── language-provider.tsx
│       │   ├── navbar.tsx
│       │   ├── results-dashboard.tsx
│       │   ├── score-donut.tsx
│       │   └── toast-provider.tsx
│       ├── lib/
│       │   ├── admin-client.ts
│       │   ├── assessment-client.ts
│       │   ├── auth-client.ts
│       │   └── error-messages.ts
│       └── package.json
├── docs/
│   └── superpowers/
│       ├── specs/                     # Design specifications
│       └── plans/                     # Implementation plans
└── package.json
```

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Superadmin | admin@env-project.sa | AdminPass1 |
| Entity Admin | ahmed@envco.sa | SecurePass1 |

---

## Running Locally

```bash
# Prerequisites: Node.js 18+, PostgreSQL on port 5433

# Install dependencies
npm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set POSTGRES_PORT=5433

cp apps/web/.env.example apps/web/.env.local

# Start API (port 4000)
npm run dev:api

# Start Web (port 3000)
npm run dev:web

# Seed superadmin
cd apps/api && npx ts-node src/admin/seed-admin.ts --email admin@env-project.sa --password AdminPass1
```
