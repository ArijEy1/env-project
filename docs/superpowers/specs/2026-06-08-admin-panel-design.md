# Admin Panel — Basic Admin Panel Design

## Overview

Platform-level admin panel for superadmins to oversee all entities, users, and assessments across the platform. Separate from entity-level admin role. Dashboard with stats, entity list, assessment list, and PDF download for any assessment.

## Access Control

New role value `superadmin` on the `users.role` column (alongside existing `admin` and `user`).

Superadmins:
- Can see ALL entities, users, and assessments across the platform
- Are created via a seed script, not through registration
- Have a dedicated "Platform Administration" system entity (since `entity_id` is NOT NULL)
- See an "Admin Panel" link in the navbar

### SuperAdmin Guard

New NestJS guard `SuperAdminGuard` that checks `req.user.role === 'superadmin'`. Returns 403 Forbidden otherwise. Applied to all `/api/admin/*` routes.

### Seed Script

Standalone script `apps/api/src/admin/seed-admin.ts` run via:
```bash
cd apps/api && npx ts-node src/admin/seed-admin.ts --email admin@env-project.sa --password AdminPass1
```

Logic:
1. Create "Platform Administration" entity if it doesn't exist (CR number: `SYSTEM-000001`, sector: `government`)
2. Create or update the superadmin user with `role: 'superadmin'`
3. Print credentials to console

## API Endpoints

All under `/api/admin`, all require JWT + `superadmin` role.

### GET /api/admin/stats

Platform-wide statistics.

Response:
```json
{
  "totalEntities": 12,
  "totalUsers": 34,
  "totalAssessments": 28,
  "submittedAssessments": 22,
  "averageScore": 58.75
}
```

### GET /api/admin/entities

All entities with aggregated counts.

Response:
```json
[
  {
    "id": "uuid",
    "nameAr": "شركة البيئة",
    "nameEn": "Env Co",
    "crNumber": "1010234567",
    "sector": "services",
    "city": "Riyadh",
    "userCount": 3,
    "assessmentCount": 2,
    "createdAt": "..."
  }
]
```

### GET /api/admin/entities/:id

Single entity with its users.

Response:
```json
{
  "id": "uuid",
  "nameAr": "...",
  "nameEn": "...",
  "crNumber": "...",
  "sector": "...",
  "city": "...",
  "users": [
    { "id": "uuid", "fullName": "Ahmed", "email": "...", "role": "admin", "createdAt": "..." }
  ]
}
```

### GET /api/admin/assessments

All assessments across the platform with entity info.

Response:
```json
[
  {
    "id": "uuid",
    "entityNameAr": "...",
    "entityNameEn": "...",
    "status": "submitted",
    "totalScore": 61.25,
    "maturityLevel": 4,
    "answeredCount": 18,
    "totalQuestions": 18,
    "createdAt": "...",
    "submittedAt": "..."
  }
]
```

### GET /api/admin/assessments/:id

Full assessment detail — reuses the existing `AssessmentService.getById()` but bypasses entity ownership check (superadmin can see any assessment).

### GET /api/admin/assessments/:id/report

Download PDF for any assessment — reuses the existing PDF generation but bypasses entity ownership check.

## Frontend Pages

### `/admin` — Dashboard

Stats cards in a grid:
- Total Entities (with icon)
- Total Users
- Total Assessments (submitted / total)
- Average Score

### `/admin/entities` — Entities List

Table/card list of all entities:
- Columns: Name (AR), CR Number, Sector, City, Users, Assessments, Registered
- Click to expand/view users

### `/admin/assessments` — Assessments List

Table/card list of all assessments:
- Columns: Entity, Status, Score, Maturity Level, Date, Actions
- "Download PDF" button for submitted assessments
- "View Results" link for submitted assessments

### Admin Layout

Shared layout with:
- Sidebar navigation: Dashboard, Entities, Assessments
- Back to main site link
- Bilingual AR/EN (uses existing `useLanguage()`)
- Same glassmorphism theme as the rest of the app

## Navbar Update

Superadmins see "لوحة التحكم" / "Admin Panel" link in the navbar pointing to `/admin`.

## Files to Create/Modify

### API
- `apps/api/src/admin/admin.module.ts` — new module
- `apps/api/src/admin/admin.controller.ts` — all admin endpoints
- `apps/api/src/admin/admin.service.ts` — admin queries
- `apps/api/src/admin/superadmin.guard.ts` — role guard
- `apps/api/src/admin/seed-admin.ts` — seed script
- `apps/api/src/app.module.ts` — import AdminModule

### Web
- `apps/web/app/admin/page.tsx` — dashboard page
- `apps/web/app/admin/entities/page.tsx` — entities list page
- `apps/web/app/admin/assessments/page.tsx` — assessments list page
- `apps/web/components/admin-layout.tsx` — shared admin layout
- `apps/web/lib/admin-client.ts` — admin API client
- `apps/web/components/navbar.tsx` — add admin link for superadmins
- `apps/web/app/globals.css` — admin styles

## Out of Scope

- Edit/delete entities or users from admin panel (Release 1.5)
- Dynamic question management (Release 1.5)
- Advanced roles/permissions (Release 1.5)
- Audit logs (Release 1.5)
- Admin search/filter/pagination (Release 1.5 — sufficient for MVP with few entities)
