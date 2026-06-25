# Assessment Engine — Design (Sections 2, 3, 5, 6, 7)

Status: **DRAFT for review** · Scope: the connected profiling → question-generation → scoring → gap-analysis → results engine.

This document is the single plan for the assessment engine. Build follows the phases in §11. Everything marked **DRAFT** is placeholder content to be replaced by the client's official lists later — **without code changes** (see Principle 1).

---

## 1. Principles

1. **Content lives in data, not code.** Domains, materiality topics, questions, answer options, weights, scoring config, and recommendations are all rows in the database, seeded as a draft set and editable through the admin backoffice (Section 9). Swapping draft → official content is a data operation, never a deploy.
2. **Server-side only.** All selection, weighting, and scoring happen on the API. The client receives results and question text, never formula logic or weights (Section 5).
3. **Immutable snapshots.** When an assessment starts, the selected questions and their effective weights are frozen into a snapshot tied to the exact profile used. Editing the bank later never changes a submitted (or in-progress) assessment (Sections 3 & 5).
4. **Profile drives everything.** A five-dimension profile selects which questions appear and how they're weighted. The user never sees the weighting logic (Section 2).
5. **Versioned config.** Question bank, materiality weights, and scoring configurations carry versions so results remain reproducible and auditable.

---

## 2. Draft taxonomies (placeholders — confirm with client)

### 2.1 Entity type (6) — DRAFT
`government` · `semi_government` · `private_company` · `sme` · `non_profit` · `education_research`

### 2.2 Sector (10; 4 "fully specified") — DRAFT
Current 9 + `mining` = 10: `oil_and_gas`, `manufacturing`, `industrial`, `construction`, `mining`, `services`, `government`, `healthcare`, `education`, `other`.
**Fully specified** (full materiality + question coverage at launch): `oil_and_gas`, `manufacturing`, `industrial`, `construction`. The rest fall back to a generic profile until content is authored.

### 2.3 Size (employee bracket) — existing
`1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+`.

### 2.4 Environmental exposure (3) — DRAFT
`low` · `medium` · `high`. Captured from the user, then possibly overridden by rules (§5).

### 2.5 Domains (6) — DRAFT
The doc references "6 domains", "D2 Regulatory Compliance", and Scope 1/2 calculators in D3 + resource efficiency in D4. Proposed:

| Code | Name (EN) | Name (AR) | Notes |
|------|-----------|-----------|-------|
| D1 | Environmental Governance & Strategy | الحوكمة والاستراتيجية البيئية | |
| D2 | Regulatory Compliance | الامتثال التنظيمي | always prioritised in gap analysis |
| D3 | Emissions & Climate | الانبعاثات والمناخ | Scope 1/2 calculators (Section 4) |
| D4 | Resource Efficiency | كفاءة الموارد | energy/water/material calculators (Section 4) |
| D5 | Waste & Circular Economy | النفايات والاقتصاد الدائري | |
| D6 | Disclosure & Stakeholders | الإفصاح وأصحاب المصلحة | |

### 2.6 Materiality topics — DRAFT
A flat list of ESG-style topics (e.g. `ghg_emissions`, `water_management`, `waste_hazardous`, `air_quality`, `energy_use`, `biodiversity`, `compliance_permits`, `reporting_disclosure`, …). Each bank question may link to **one** materiality topic; weighting multipliers are keyed by topic (§4).

---

## 3. Database schema

New/changed tables. All text content is bilingual (`_ar` / `_en`). Migrations are additive and created in `DatabaseService.onModuleInit` (same pattern as today), or moved to a real migration runner if we adopt one.

### 3.1 `entities` (extend)
Add: `entity_type VARCHAR(40)`, `environmental_exposure VARCHAR(10)` (effective, post-override), `submitted_exposure VARCHAR(10)` (what the user chose, for audit), `profile_locked_at TIMESTAMPTZ NULL`.

### 3.2 `domains`
`id` (D1..D6), `name_ar`, `name_en`, `display_order`, `active`.

### 3.3 `materiality_topics`
`id`, `code`, `name_ar`, `name_en`, `domain_id`, `active`.

### 3.4 `question_bank`
`id`, `code`, `domain_id`, `text_ar`, `text_en`, `help_text_ar`, `help_text_en`, `materiality_topic_id NULL`, `base_weight NUMERIC`, `calculator_type VARCHAR NULL` (e.g. `scope12`, `resource_efficiency`), `applicability JSONB`, `active`, `version`.
- `applicability` encodes which profiles include the question, e.g. `{ "sectors": ["oil_and_gas","industrial"], "exposure_min": "medium", "entity_types": null, "size_min": null }`. `null`/absent = applies to all.

### 3.5 `materiality_weights`
Multipliers applied to a topic for a given profile dimension value:
`id`, `dimension` (`sector`|`exposure`|`entity_type`|`size`), `dimension_value`, `materiality_topic_id`, `multiplier NUMERIC`, `version`.
- Effective multiplier for a topic = product (or configurable combine fn) of the matching rows across dimensions. Default 1.0 when none match.

### 3.6 `scoring_configurations`
`id`, `name`, `domain_weights JSONB` (e.g. `{"D1":0.15,"D2":0.25,"D3":0.2,"D4":0.15,"D5":0.15,"D6":0.1}` summing to 1), `active BOOLEAN`, `version`, `created_at`. Exactly one active config at a time.

### 3.7 `assessments` (extend)
Add: `profile_snapshot JSONB` (frozen five-dimension profile), `scoring_config_id`, `domain_scores JSONB` (D1..D6), `total_score NUMERIC`, `maturity_level INT`, `calculation_audit JSONB`, `submitted_at`. Keep `status` (`draft`|`submitted`). `calculation_audit` is written once on submit and never mutated.

### 3.8 `assessment_questions` (the immutable snapshot)
`id`, `assessment_id`, `bank_question_id`, `domain_id`, `materiality_topic_id NULL`, `effective_weight NUMERIC` (base × materiality multiplier, **frozen**), `display_order`, `text_ar`, `text_en` (copied so later edits don't change history).

### 3.9 `assessment_answers` (extend)
Link to `assessment_questions.id`; `score INT CHECK (score IN (0,25,50,75,100))`; plus optional `calculator_inputs JSONB` for D3/D4 calculator-backed questions.

### 3.10 `recommendation_library`
`id`, `materiality_topic_id` or `bank_question_id`, `domain_id`, `trigger_max_score INT` (recommend when question score ≤ this), `immediate_action_ar/en`, `short_term_action_ar/en`, `medium_term_action_ar/en`, `cost_estimate`, `effort_level` (`low`|`medium`|`high`), `score_impact_points INT`, `timeline_weeks INT`, `legal_reference`, `active`, `version`. (The "5 fields per recommendation" from Section 9 = the three action tiers + cost + the metadata.)

### 3.11 `regulatory_mappings`
`id`, `bank_question_id`, `regulation`, `clause`, `authority` (NCEC/MEWA/…), `url`. Powers the admin "regulatory mapping viewer" (Section 9).

---

## 4. Profile → question selection → snapshot (Section 3)

On **assessment create**:
1. Read the entity's five-dimension profile (entity type, sector, size, exposure, + derived materiality set).
2. Select bank questions whose `applicability` matches the profile → target **30–80** of the 120–150 bank.
3. For each selected question, compute `effective_weight = base_weight × materialityMultiplier(topic, profile)`.
4. Insert frozen rows into `assessment_questions` (copying text + weight + order). Store `profile_snapshot` on the assessment.
5. The user answers only this frozen set; later bank edits don't affect it.

`materialityMultiplier(topic, profile)` = combine matching `materiality_weights` rows across dimensions (default product, clamp to a sane range). Topics with no rows = 1.0.

---

## 5. Exposure override (Section 2)

After the user submits the profile, apply ordered rules, then **notify** the user if the effective exposure differs from what they chose. Store both values. **DRAFT** rules:
- sector ∈ {oil_and_gas, industrial, manufacturing, mining} → exposure = `high`
- sector = construction → exposure ≥ `medium`
- size = `1000+` → bump exposure up one level (cap `high`)

Rules live in config/data so they're tunable. The profile **locks** (`profile_locked_at`) the moment the first assessment is created; further edits require a new assessment (enforced in `updateEntity` and assessment create).

---

## 6. Scoring engine (Section 5) — server-side only

For a submitted assessment, using the frozen `assessment_questions` + answers:

- **Normalised domain score** (per domain D):
  `score_D = Σ(answer_score × effective_weight) / Σ(100 × effective_weight) × 100`
  over questions in D. Range 0–100.
- **Total score** = `Σ(score_D × domain_weight_D)` using the active `scoring_configurations.domain_weights`. Range 0–100.
- **Maturity level** = `CEILING(total_score / 20)`, clamped to **1–5**.
- **calculation_audit** (JSONB, immutable): the full breakdown — per-question (answer, weight, contribution), per-domain (numerator, denominator, score), domain weights, scoring config id/version, total, maturity, timestamp. This is the auditable record and the source for the dashboard.

Submission is the only writer of scores + audit; once `status='submitted'`, all of it is read-only.

---

## 7. Gap analysis & recommendations (Section 6)

1. From the audit, rank answered questions by **weighted score** (`answer × effective_weight`) ascending → lowest-performing first.
2. **D2 (Regulatory Compliance) gaps always float to the top** regardless of raw rank.
3. For each gap question/topic with `answer ≤ trigger_max_score`, pull matching `recommendation_library` rows.
4. **Rank by Impact × Effort**: high `score_impact_points` + low `effort_level` first.
5. Build the **roadmap** from real library data (cost, timeline weeks) grouped into Immediate / Short-term / Medium-term tiers.
6. Phase 1 is **rule-based matching only**; AI-assisted matching is deferred to Release 3 (Section 6 note).

---

## 8. Results dashboard (Section 7)

Reads only from the submitted assessment + `calculation_audit`:
- Maturity level with colour-coded badge (1–5).
- Total score /100 with animated circular progress.
- Interactive **radar chart** across all 6 domains, exact score on hover.
- Six **domain cards**: score, maturity badge, single-line top gap.
- Profile summary card (entity type, sector, size, exposure used).
- Recommendations panel: tabs Immediate / Short-term / Medium-term, each row showing cost, effort, score impact.

Charting: a lightweight lib (e.g. Recharts) or hand-rolled SVG radar/donut to avoid heavy deps. To be decided in Phase F.

---

## 9. Admin backoffice (Section 9 — required to manage the data)
Because content is data, the backoffice is what makes draft → official a no-deploy swap:
- Entity management (orgs, sector, status, maturity, last activity).
- Question bank management (view all with metadata, activate/deactivate, edit).
- Recommendation library management (edit all fields).
- Regulatory mapping viewer.
- Platform statistics (registrations, completions, avg maturity by sector, downloads).

---

## 10. Calculators (Section 4, within D3/D4)
Questions with `calculator_type` render an inline calculator (Scope 1/2 emissions in D3; energy/water/material efficiency in D4). The calculator collects `calculator_inputs JSONB`, derives the 0–100 answer via a documented server-side formula, and stores both. Autosave + localStorage fallback already exist and extend to calculator inputs.

---

## 11. Build phases & sequencing

| Phase | Scope | Delivers |
|-------|-------|----------|
| **A. Foundations** | Schema for §3 tables + entity profile fields; draft seed data; config loaders | The data backbone + a swappable draft content set |
| **B. Section 2** | Profile fields in register/account, exposure override + notify, profile lock, pre-assessment summary/confirm | Complete, shippable profiling layer |
| **C. Section 3** | Selection algorithm + materiality weighting + immutable snapshot on create | Personalised question sets |
| **D. Section 5** | 6-domain server-side scoring, scoring_configurations, calculation_audit | Correct, auditable scoring |
| **E. Section 6** | Gap analysis + recommendation engine + roadmap | Recommendations from library |
| **F. Section 7** | Results dashboard (radar, domain cards, maturity badge, tabs) | Client-facing results |
| **G. Section 9** | Admin management screens for all content | Self-service content editing (enables real-data swap) |
| **(Section 4)** | D3/D4 calculators, help tooltips | Richer answering UX (slot into C/F) |

Phases A→B are independent of the client's final questions and can start now. C onward consumes the draft bank and improves automatically when real content is loaded via G.

---

## 12. Open questions for the client
1. Confirm the **6 entity types** and **environmental exposure** levels (3 vs a finer scale?).
2. Confirm the **10 sectors** and which **4 are "fully specified"** at launch.
3. The **6 domains** (names + D-codes) and their default **domain weights** in `scoring_configurations`.
4. The **materiality topic** list and the **multiplier** values per sector/exposure.
5. The **120–150 question bank** with: domain, materiality topic, base weight, applicability, help text, calculator flag.
6. The **exposure override rules** (the §5 draft is a placeholder).
7. The **recommendation library** content (3 action tiers + cost + effort + score impact + timeline + legal reference per item).
8. **Regulatory mappings** (question → clause/authority).

Until these arrive, Phases A/B build against the draft taxonomies in §2; later content loads as data through the Phase G backoffice.
