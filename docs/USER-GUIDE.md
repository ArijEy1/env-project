# User Guide — Environmental Compliance Maturity Tool

## دليل المستخدم — الأداة الوطنية لقياس النضج البيئي

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Registration](#2-registration)
3. [Login](#3-login)
4. [Account Management](#4-account-management)
5. [Taking an Assessment](#5-taking-an-assessment)
6. [Viewing Results](#6-viewing-results)
7. [Downloading the PDF Report](#7-downloading-the-pdf-report)
8. [Recommendations](#8-recommendations)
9. [Admin Panel](#9-admin-panel)
10. [Language Switching](#10-language-switching)
11. [FAQ](#11-faq)

---

## 1. Getting Started

The Environmental Compliance Maturity Tool is a web-based platform that helps Saudi organizations assess their environmental compliance maturity. The tool evaluates two key domains:

- **Environmental Governance** (الحوكمة البيئية) — 45% of the total score
- **Regulatory Compliance** (الامتثال التنظيمي) — 55% of the total score

After completing the assessment, you receive:
- A maturity score out of 100
- A maturity level (1-5)
- Three actionable recommendations
- A professional Arabic PDF report

### Access the Platform

Open your browser and navigate to:
- **Website**: `http://localhost:3000`
- **API**: `http://localhost:4000/api`

---

## 2. Registration

### Step-by-step:

1. Click **"ابدأ الآن"** (Start Now) or navigate to `/register`

2. **Section 1 — Organization Details (بيانات المنشأة)**:
   - **Organization name (Arabic)** *(required)*: Enter your organization's name in Arabic
   - **Organization name (English)**: Optional English name
   - **CR Number** *(required)*: Your Commercial Registration number (e.g., 1010234567)
   - **Sector** *(required)*: Select from: Industrial, Oil & Gas, Manufacturing, Construction, Services, Government, Healthcare, Education, Other
   - **City** *(required)*: Your organization's city
   - **Region**: Optional (e.g., Riyadh Region)
   - **Number of employees**: Select bracket (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
   - **Organization email**: Contact email
   - **Organization phone**: Contact phone
   - **Unified national number**: If applicable

3. **Section 2 — Your Account (حسابك)**:
   - **First name** *(required)*
   - **Last name**
   - **Email** *(required)*: This will be your login email
   - **Phone**
   - **Job role**: e.g., Environmental Manager
   - **Password** *(required)*: Minimum 8 characters, must include uppercase letter, lowercase letter, and a digit
   - **Confirm password** *(required)*

4. Click **"إنشاء الحساب"** (Create Account)

5. You'll be redirected to your account page

> **Note**: The first user who registers an organization automatically becomes the organization's **admin**. Only admins can edit organization details.

---

## 3. Login

1. Navigate to `/login`
2. Enter your **email** and **password**
3. Click **"تسجيل الدخول"** (Log In)
4. You'll be redirected to your account page

### Forgot Password?

1. Click **"نسيت كلمة المرور؟"** on the login page
2. Enter your email address
3. Check your email for a reset link
4. Click the link and set a new password

> **Security**: After 5 failed login attempts, your account is locked for 15 minutes.

---

## 4. Account Management

### Viewing Your Account

Navigate to `/account` or click **"حسابي"** (My Account) in the navbar.

Your account page shows:
- **Assessment Status**: Continue a draft or start a new assessment
- **Organization Details**: All entity information
- **Your Profile**: Personal information and role

### Editing Your Profile

1. Click **"تعديل"** (Edit) on the "Your Profile" card
2. Update your first name, last name, phone, or job role
3. Click **"حفظ"** (Save)

### Editing Organization Details (Admin Only)

1. Click **"تعديل"** (Edit) on the "Organization Details" card
2. Update the name, contact email, or phone
3. Click **"حفظ"** (Save)

> Only users with the **admin** role can edit organization details.

### Logging Out

Click **"تسجيل الخروج"** (Logout) at the bottom of the account page, or use the Logout button in the navbar.

---

## 5. Taking an Assessment

### Starting a New Assessment

1. Click **"بدء التقييم"** (Start Assessment) in the navbar, or click the button on your account page
2. If you have an unfinished draft, you'll be taken to it automatically
3. Only one draft assessment per organization is allowed

### The Assessment Wizard

The assessment consists of **18 questions** divided into two domains:

**Domain 1: Environmental Governance (Questions 1-9)**
Topics include: environmental policy, management team, strategic planning, leadership oversight, budget allocation, training, stakeholder engagement, audits, KPIs.

**Domain 2: Regulatory Compliance (Questions 10-18)**
Topics include: NCEC licensing, MEWA compliance, impact assessments, waste management, air emissions, hazardous materials, ISO 14001, inspection readiness, incident reporting.

### Answering Questions

For each question, select one of five options:

| Score | Arabic | English |
|-------|--------|---------|
| 0 | لا يوجد | Does not exist |
| 25 | في مرحلة التخطيط | In planning stage |
| 50 | مطبّق جزئيًا | Partially implemented |
| 75 | مطبّق بشكل كبير | Largely implemented |
| 100 | مطبّق بالكامل ومُراجَع دوريًا | Fully implemented and periodically reviewed |

### Navigation

- Click an answer option to select it — it **saves automatically**
- Click **"التالي"** (Next) to advance
- Click **"السابق"** (Previous) to go back
- Your answers are preserved when navigating
- A **progress bar** at the top shows your position (e.g., "5 / 18")
- The **domain badge** shows which section you're in

### Domain Transition

After completing the governance section (Q9), a transition screen appears:
> "Environmental Governance complete. Now starting Regulatory Compliance."

Click **"متابعة"** (Continue) to proceed.

### Auto-save & Resume

- Every answer is **saved immediately** when selected
- If the save fails (network issue), your answer is **saved locally** and synced later
- A save indicator shows: "جاري الحفظ..." → "تم الحفظ" → or "فشل الحفظ — محفوظ محلياً"
- If you leave and come back, the wizard **resumes where you left off**
- Your account page shows draft progress: "X / 18 answered"

### Submitting

- On the last question (Q18), click **"إرسال التقييم"** (Submit Assessment)
- A confirmation dialog appears showing how many questions you've answered
- All 18 questions must be answered to submit
- Once submitted, the assessment is **locked** and cannot be modified
- You're redirected to the results page

---

## 6. Viewing Results

After submitting, you're taken to the **Results Dashboard** at `/assessment/{id}/results`.

### What You See

**Total Score**: A donut chart showing your overall score out of 100, color-coded by maturity level.

**Maturity Level**: Your classification from 1 to 5:

| Level | Score Range | Arabic | English | Color |
|-------|------------|--------|---------|-------|
| 1 | 0 – 20 | مبتدئ | Beginning | Red |
| 2 | 21 – 40 | أساسي | Basic | Orange |
| 3 | 41 – 60 | متوسط | Intermediate | Lime |
| 4 | 61 – 80 | متقدم | Advanced | Teal |
| 5 | 81 – 100 | رائد | Leading | Green |

**Domain Scores**: Two cards showing:
- Environmental Governance score with weight (45%)
- Regulatory Compliance score with weight (55%)

### Scoring Formula

```
Total Score = (Governance Average × 0.45) + (Compliance Average × 0.55)
```

Each domain average is the mean of its 9 question scores.

---

## 7. Downloading the PDF Report

1. On the results page, click **"تحميل التقرير PDF"** (Download PDF Report)
2. A 2-page Arabic PDF is generated and downloaded

### PDF Contents

**Page 1 — Summary:**
- Platform title and branding
- Organization name and submission date
- Unique reference number (ENV-YYYY-NNNNNN)
- Total score and maturity level
- Domain scores with weights
- Methodology explanation

**Page 2 — Recommendations:**
- Top 3 improvement areas
- For each: the question, your score, recommended action, expected impact, and regulatory reference

---

## 8. Recommendations

Below the score cards on the results page, you'll find **3 recommendations** — the areas where your organization scored lowest.

Each recommendation includes:
- **The question** you scored lowest on
- **Your score** for that question
- **Recommended action**: specific steps to improve
- **Expected impact**: what improvement will achieve
- **Reference**: the relevant regulation or standard (ISO 14001, NCEC, MEWA, etc.)

> Recommendations are rule-based and generated from expert-reviewed templates mapped to Saudi environmental regulations.

---

## 9. Admin Panel

### Accessing the Admin Panel

The admin panel is available only to **superadmin** users.

1. Log in with superadmin credentials
2. Click **"لوحة التحكم"** (Admin Panel) in the navbar
3. Or navigate directly to `/admin`

### Dashboard (`/admin`)

Shows platform-wide statistics:
- Total registered entities
- Total users
- Completed assessments (submitted / total)
- Average maturity score

### Entities List (`/admin/entities`)

Lists all registered organizations with:
- Name (Arabic/English)
- CR number
- Sector and city
- Number of users
- Number of assessments
- Registration date

**Search**: Type in the search bar to filter by name or CR number.
**Filters**: Use the sector and city dropdowns to narrow results.
**Clear**: Click "مسح" (Clear) to reset all filters.

### Assessments List (`/admin/assessments`)

Lists all assessments across the platform with:
- Entity name
- User who created it
- Status (Draft / Submitted)
- Score and maturity level
- Date
- Action buttons: **Results** (view) and **PDF** (download)

**Search**: Filter by entity name or user name.
**Filters**: Filter by status (Draft/Submitted) and maturity level (1-5).

### Creating a Superadmin

Run this command on the server:

```bash
cd apps/api
npx ts-node src/admin/seed-admin.ts --email admin@env-project.sa --password AdminPass1
```

---

## 10. Language Switching

The platform supports **Arabic (RTL)** and **English (LTR)**.

- Click **AR** or **EN** in the navbar to switch
- The language preference is saved in your browser
- All labels, questions, answers, recommendations, and error messages are bilingual
- Arabic is the default language

---

## 11. FAQ

### Can I retake an assessment?
Yes. After submitting an assessment, you can start a new one from your account page. Previous assessments remain accessible in your history.

### Can I edit answers after submitting?
No. Submitted assessments are locked. You can start a new assessment instead.

### What if I lose internet during the assessment?
Your answers are saved locally in your browser. When your connection returns, they'll sync automatically to the server.

### Who can see my assessment results?
- You and other users in your organization
- Platform administrators (superadmins)

### What do the maturity levels mean?

- **Level 1 — Beginning**: No or minimal environmental practices in place
- **Level 2 — Basic**: Some awareness and initial planning started
- **Level 3 — Intermediate**: Documented processes partially implemented
- **Level 4 — Advanced**: Comprehensive practices largely in place
- **Level 5 — Leading**: Fully integrated, reviewed, and continuously improved

### How is the score calculated?
Each question is scored 0-100. Domain averages are weighted (Governance 45%, Compliance 55%) and combined into a total score. The maturity level is derived from the total score.

### Are the questions final?
The current 18 questions are draft placeholders based on Saudi environmental regulations. The client will provide the final question text — the system is built to swap them easily without code changes to the scoring or recommendation logic.
