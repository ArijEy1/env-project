# M8 — Autosave and Continuity Design

## Overview

Enhance the existing auto-save behavior with localStorage fallback for offline resilience, a visible "last saved" indicator, and a resume card on the account page for unfinished assessments. All changes are frontend-only.

## What Already Exists (from M2)

- Auto-save answer on selection via `PUT /api/assessments/:id/answer`
- Debounced progress save via `PUT /api/assessments/:id/progress`
- Resume from `currentQuestionIndex` on page load
- `/assessment/new` detects existing draft and redirects
- One-draft-per-entity API enforcement

## 1. localStorage Fallback

When `saveAnswer()` fails (network error, server down):
- Store the answer in localStorage under key `env-pending-{assessmentId}`
- Value: JSON object `{ [questionId]: score, ... }`
- On component mount, check for pending answers and attempt to sync them
- On each successful save, also attempt to flush any pending answers
- After successful sync, clear the localStorage entry

This ensures no answer is lost even if the user's connection drops mid-assessment.

## 2. Save Indicator

Small status line below the progress bar in the wizard:
- Default: hidden (no indicator when idle)
- On save: "جاري الحفظ..." / "Saving..." (brief flash)
- On success: "تم الحفظ" / "Saved" (fades after 2 seconds)
- On failure: "فشل الحفظ — محفوظ محلياً" / "Save failed — saved locally" (stays visible, warning color)

## 3. Resume Card on Account Page

On the account page, above the entity/profile cards, show an assessment status card:

**If draft exists:**
```
┌─────────────────────────────────────────────┐
│  📋 لديك تقييم غير مكتمل                     │
│  You have an incomplete assessment           │
│                                             │
│  X / 18 سؤال تمت الإجابة عليه                │
│  ██████░░░░░░░ X/18                         │
│                                             │
│  [متابعة التقييم / Continue Assessment]       │
└─────────────────────────────────────────────┘
```

**If no draft:**
```
┌─────────────────────────────────────────────┐
│  [بدء تقييم جديد / Start New Assessment]     │
└─────────────────────────────────────────────┘
```

**If submitted assessments exist:** show a list below with scores and links to results.

Data source: `GET /api/assessments` (already exists, returns list with status, answeredCount, totalQuestions).

## Files to Modify

- `apps/web/components/assessment-wizard.tsx` — localStorage fallback + save indicator
- `apps/web/components/account-panel.tsx` — assessment resume/start card + history
- `apps/web/lib/assessment-client.ts` — add localStorage helper functions
- `apps/web/app/globals.css` — styles for save indicator and assessment card

## Out of Scope

- Email reminders for unfinished assessments (Release 1.5)
- Offline-first / service worker approach
- "Last saved" timestamp persistence across sessions
