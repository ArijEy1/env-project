# M1 — Authentication & Entity Profile Design

## Overview

Complete the authentication foundation and add organization (entity) profiles. Each entity represents an organization being assessed. Users belong to an entity and have roles (admin/user). Registration is a two-step form: create organization, then create user account under it.

## Database Schema

### New table: `entities`

```sql
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
);
```

Sector values: `industrial`, `oil_and_gas`, `manufacturing`, `construction`, `services`, `government`, `healthcare`, `education`, `other`.

Employee count brackets: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+`.

### Modified table: `users`

Add columns:
- `entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE`
- `role VARCHAR(20) NOT NULL DEFAULT 'user'` — values: `admin`, `user`

Remove columns:
- `entity` (replaced by `entity_id` FK)
- `country_code` (organization-level concern, use `entities.contact_phone`)

Keep columns unchanged:
- `id`, `first_name`, `last_name`, `full_name`, `email`, `password_hash`, `phone`, `job_role`, `created_at`

Migration approach: since this is early development with no production data, drop and recreate tables on startup via `DatabaseService.ensureUsersTable()` / new `ensureEntitiesTable()`.

## API Endpoints

### POST /api/auth/register

Request body:

```json
{
  "entity": {
    "nameAr": "شركة البيئة للاستشارات",
    "nameEn": "Environment Consulting Co.",
    "crNumber": "1010234567",
    "sector": "services",
    "city": "Riyadh",
    "region": "Riyadh Region",
    "employeeCountBracket": "51-200",
    "contactEmail": "info@envco.sa",
    "contactPhone": "+966112345678",
    "unifiedNationalNumber": "7001234567"
  },
  "user": {
    "firstName": "Ahmed",
    "lastName": "Al-Salem",
    "email": "ahmed@envco.sa",
    "phone": "0501234567",
    "jobRole": "Environmental Manager",
    "password": "SecurePass123"
  }
}
```

Logic:
1. Validate all fields
2. Check CR number uniqueness
3. Check email uniqueness
4. Create entity row
5. Create user row with `entity_id` = new entity, `role` = `admin`
6. Return JWT + user + entity

Response:

```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "uuid",
    "firstName": "Ahmed",
    "lastName": "Al-Salem",
    "fullName": "Ahmed Al-Salem",
    "email": "ahmed@envco.sa",
    "phone": "0501234567",
    "jobRole": "Environmental Manager",
    "role": "admin",
    "createdAt": "2026-06-08T12:00:00Z",
    "entity": {
      "id": "uuid",
      "nameAr": "شركة البيئة للاستشارات",
      "nameEn": "Environment Consulting Co.",
      "crNumber": "1010234567",
      "sector": "services",
      "city": "Riyadh",
      "region": "Riyadh Region",
      "employeeCountBracket": "51-200",
      "contactEmail": "info@envco.sa",
      "contactPhone": "+966112345678",
      "unifiedNationalNumber": "7001234567",
      "createdAt": "2026-06-08T12:00:00Z"
    }
  }
}
```

### POST /api/auth/login

Unchanged request body (email + password). Response now includes nested entity object (same shape as register response).

### GET /api/auth/me

Returns user + nested entity. Same response shape as register/login.

### PUT /api/auth/profile

Authenticated. Update current user's own fields.

```json
{
  "firstName": "Ahmed",
  "lastName": "Al-Salem",
  "phone": "0509876543",
  "jobRole": "Senior Environmental Manager"
}
```

Returns updated user + entity.

### PUT /api/auth/entity

Authenticated. Admin role only. Update entity fields.

```json
{
  "nameAr": "شركة البيئة المتقدمة",
  "nameEn": "Advanced Environment Co.",
  "contactEmail": "new@envco.sa"
}
```

Returns updated entity.

### Unchanged endpoints

- `POST /api/auth/forgot-password` — no changes
- `POST /api/auth/reset-password` — no changes

## Brute-Force Protection

In-memory rate limiter on the login endpoint.

- Data structure: `Map<string, { failCount: number; lockedUntil: number | null }>`
- Key: lowercase email
- On failed login: increment `failCount`
- On `failCount >= 5`: set `lockedUntil` to `Date.now() + 15 * 60 * 1000`
- On locked attempt: return 401 with generic "Invalid credentials" (no lockout leak)
- On successful login: delete the entry
- Cleanup: optional periodic sweep of expired entries (every 30 minutes)

Implementation: `LoginRateLimiter` class injected into `AuthService`. Not a NestJS guard — just a service-level check inside the login method.

## DTO Validation

### RegisterDto (restructured)

```
RegisterDto {
  entity: EntityDto {
    nameAr: string (required, min 2)
    nameEn?: string
    crNumber: string (required, min 5)
    sector: string (required, must be one of allowed values)
    city: string (required)
    region?: string
    employeeCountBracket?: string (must be one of allowed values if provided)
    contactEmail?: string (valid email if provided)
    contactPhone?: string
    unifiedNationalNumber?: string
  }
  user: UserDto {
    firstName: string (required, min 1)
    lastName?: string
    email: string (required, valid email)
    phone?: string
    jobRole?: string
    password: string (required, min 8, must contain uppercase + lowercase + digit)
  }
}

Note: `fullName` is computed server-side as `firstName + " " + lastName` (trimmed). Not sent by the client.
```

Password policy change: bumped from 6 to 8 chars, must include uppercase, lowercase, and digit. This is appropriate for an institutional Saudi product.

## Frontend Changes

### Registration page (`/register`)

Two-section form replacing the current flat form:

**Section 1: Organization Details (بيانات المنشأة)**
- Organization name (Arabic) — text input, required
- Organization name (English) — text input, optional
- Commercial Registration number — text input, required
- Sector — dropdown, required
- City — text input, required
- Region — text input, optional
- Number of employees — dropdown, optional
- Contact email — email input, optional
- Contact phone — tel input, optional
- Unified national number — text input, optional

**Section 2: Your Account (حسابك)**
- First name — required
- Last name — optional
- Email — required
- Phone — optional
- Job role — free text input (replacing dropdown)
- Password — required (min 8, show requirements)
- Confirm password — required

### Account page (`/account`)

Show both user and entity information in two cards/sections. Add "Edit" buttons that toggle inline editing for profile fields and entity fields (admin only).

### Auth client (`lib/auth-client.ts`)

- Update `RegisterPayload` to nested `{ entity, user }` shape
- Update `AuthUser` to include `role` and nested `entity` object
- Add `updateProfile()` and `updateEntity()` functions

### All forms

- Bilingual labels (Arabic + English) via existing `useLanguage()` hook
- RTL layout when Arabic is active (already partially supported)
- Arabic validation error messages

## Files to Create/Modify

### API (apps/api/src/)
- `database/database.service.ts` — add `ensureEntitiesTable()`, modify `ensureUsersTable()`
- `auth/entities/entity.entity.ts` — new file, EntityEntity interface
- `auth/entities/user.entity.ts` — add `role`, `entityId`, `entity` fields
- `auth/dto/register.dto.ts` — restructure to nested entity + user
- `auth/dto/update-profile.dto.ts` — new file
- `auth/dto/update-entity.dto.ts` — new file
- `auth/auth.service.ts` — update register, login, getProfile; add updateProfile, updateEntity; add rate limiter
- `auth/auth.controller.ts` — add PUT /profile, PUT /entity endpoints
- `auth/login-rate-limiter.ts` — new file

### Web (apps/web/)
- `lib/auth-client.ts` — update types and payloads
- `components/auth-form.tsx` — restructure register form to two sections
- `components/account-panel.tsx` — show entity info, add edit functionality
- `app/globals.css` — styles for new form sections

## Out of Scope

- User invitation system (Release 1.5)
- Multiple roles beyond admin/user (Release 1.5)
- Email OTP verification (Release 1.5)
- Audit logging (Release 1.5)
- OAuth / social login
