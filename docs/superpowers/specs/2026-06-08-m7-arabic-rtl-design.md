# M7 — Arabic RTL Interface Polish Design

## Overview

Polish the Arabic RTL experience across the app. Most bilingual text and RTL direction are already in place from M1-M6. This task focuses on: proper Arabic font, Arabic error messages, navbar assessment link, RTL arrow fixes, and minor CSS polish.

## 1. Noto Sans Arabic Font

Load `Noto Sans Arabic` via `next/font/google` in `apps/web/app/layout.tsx`. Weights: 400 (regular), 600 (semibold), 700 (bold). Apply the font class to `<body>`.

Replace the `font-family: Arial, Helvetica, sans-serif` in `globals.css` with the Next.js font variable.

This gives:
- Proper Arabic character rendering (ligatures, shaping)
- Preloaded font with `swap` strategy (no FOUT)
- Fallback to system Arabic fonts

## 2. Arabic Error Messages

Create `apps/web/lib/error-messages.ts` — a mapping function that translates common API error strings to Arabic.

Known API error messages that need translation:
- `"Email already exists"` → `"البريد الإلكتروني مستخدم بالفعل"`
- `"Invalid credentials"` → `"بيانات الدخول غير صحيحة"`
- `"An organization with this CR number already exists"` → `"يوجد منشأة مسجلة بهذا الرقم بالفعل"`
- `"Password must contain at least one uppercase letter, one lowercase letter, and one digit"` → `"يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم على الأقل"`
- `"A draft assessment already exists for your organization"` → `"يوجد تقييم مسودة للمنشأة بالفعل"`
- `"Assessment is already submitted"` → `"تم إرسال التقييم بالفعل"`
- `"All 18 questions must be answered before submitting"` → `"يجب الإجابة على جميع الأسئلة الـ 18 قبل الإرسال"`
- `"Reset link is invalid or has expired"` → `"رابط إعادة التعيين غير صالح أو منتهي الصلاحية"`
- `"Report is only available for submitted assessments"` → `"التقرير متاح فقط للتقييمات المرسلة"`
- `"User not found"` → `"المستخدم غير موجود"`
- `"Unauthorized"` → `"غير مصرح"`
- Class-validator messages containing common patterns: `"must be longer than"`, `"must be one of"`, `"must be an email"`, etc.

Function signature:
```typescript
export function translateError(message: string, isArabic: boolean): string
```

If `isArabic` is false, return the original message. If Arabic, attempt exact match first, then pattern match for class-validator messages, then return original as fallback.

Integrate into all components that display errors: `auth-form.tsx`, `account-panel.tsx`, `assessment-wizard.tsx`, `results-dashboard.tsx`.

## 3. Navbar Assessment Link

Add a "بدء التقييم" / "Start Assessment" link to the navbar for authenticated users. Links to `/assessment/new`.

Position: after the main nav links, before the header actions. Or as part of the authenticated links list.

## 4. RTL Arrow Fixes

The wizard navigation buttons currently use:
- `'→ السابق' : '← Previous'` 
- `'التالي ←' : 'Next →'`

In Arabic RTL, the visual direction is reversed. The arrows should match the visual direction:
- Arabic Previous: `'السابق →'` (arrow points right = visually "back" in RTL)
- Arabic Next: `'← التالي'` (arrow points left = visually "forward" in RTL)

Wait — actually let me re-check. In RTL layout:
- "Back" should point right (→) in Arabic because right is the "start" direction
- "Next" should point left (←) in Arabic because left is the "end" direction

Current code has `'→ السابق'` for Arabic back and `'التالي ←'` for Arabic next. This is actually correct. Let me verify by checking the actual component.

Actually the current code has `'→ رجوع' : '← Back'` for the transition screen. Need to audit all instances and ensure consistency:
- Arabic back: `'السابق →'`  
- Arabic next: `'← التالي'`
- English back: `'← Previous'`
- English next: `'Next →'`

## 5. CSS Polish

- Replace `font-family: Arial, Helvetica, sans-serif` with the Noto Sans Arabic font variable
- Add `font-feature-settings: 'liga' 1` for Arabic ligatures
- Ensure form `input`, `select`, `textarea` inherit the font
- Verify `letter-spacing` isn't too wide for Arabic (Arabic text shouldn't have letter-spacing)

## Files to Create/Modify

- `apps/web/app/layout.tsx` — Noto Sans Arabic via next/font/google
- `apps/web/app/globals.css` — font-family update, ligature settings, minor RTL fixes
- `apps/web/lib/error-messages.ts` — new file, error translation function
- `apps/web/components/navbar.tsx` — add assessment link for authenticated users
- `apps/web/components/auth-form.tsx` — use translateError
- `apps/web/components/account-panel.tsx` — use translateError
- `apps/web/components/assessment-wizard.tsx` — use translateError, verify arrow directions
- `apps/web/components/results-dashboard.tsx` — use translateError

## Out of Scope

- Full WCAG AA audit (spec mentions it but it's a polish task for Release 1.5)
- Arabic number formatting (٠١٢ vs 012) — Latin numerals are standard in Saudi institutional products
- Full typography scale overhaul
