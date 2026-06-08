# M6 — Professional PDF Report Design

## Overview

Server-side PDF generation using PDFKit. Two-page A4 Arabic RTL report with entity details, scores, maturity level, domain breakdown, recommendations, methodology, and unique reference number. Returned as a downloadable file from a new API endpoint.

## API Endpoint

`GET /api/assessments/:id/report`

- Authenticated (JWT Bearer token)
- Only for submitted assessments belonging to the user's entity
- Returns `Content-Type: application/pdf` with `Content-Disposition: attachment; filename="ENV-2026-XXXXXX.pdf"`
- Streams the PDF directly to the response (no file saved on disk)

## PDF Structure

### Page 1: Summary

**Header band** (teal background):
- App title: "الأداة الوطنية لقياس النضج البيئي" / "National Environmental Maturity Tool"
- Subtitle: "تقرير التقييم البيئي" / "Environmental Assessment Report"

**Entity info section:**
- Entity name (Arabic, and English if available)
- Submission date (formatted in Arabic locale)
- Reference number: `ENV-YYYY-NNNNNN`

**Score section:**
- Total score: large number with /100
- Maturity level: number + label (AR + EN) + color indicator
- Domain scores in two columns:
  - Governance: score/100, weight 45%
  - Compliance: score/100, weight 55%

**Methodology section** (bottom of page 1):
- Formula: `(governance_avg × 0.45) + (compliance_avg × 0.55)`
- 18 questions across 2 domains
- Scale: 0, 25, 50, 75, 100
- Maturity levels table: Level 1 (0-20) through Level 5 (81-100)

**Footer:** Reference number · Date · Page 1/2

### Page 2: Recommendations

**Header:** "التوصيات الرئيسية" / "Key Recommendations"

**3 recommendation cards**, each containing:
- Rank number
- Original question text (Arabic)
- Score achieved
- Recommended action (Arabic)
- Expected impact (Arabic)
- Legal/regulatory reference

**Footer:** Reference number · Date · Page 2/2

## Reference Number

Format: `ENV-YYYY-NNNNNN`
- YYYY = submission year
- NNNNNN = random 6-digit zero-padded number
- Generated at render time, not stored

## Font

Noto Sans Arabic, embedded in the PDF:
- Regular (400) for body text
- Bold (700) for headings and scores

Font files stored at `apps/api/assets/fonts/NotoSansArabic-Regular.ttf` and `NotoSansArabic-Bold.ttf`.

Download from Google Fonts. These are TTF files, ~500KB each.

## Colors

- Header background: #0f3d48 (midnight)
- Header accent line: #d8b16c (sand)
- Body text: #17302c
- Secondary text: #4d6761
- Score highlight: #0f6b5b (emerald)
- Maturity level colors: #E24B4A (L1), #EF9F27 (L2), #ADD378 (L3), #5DCAA5 (L4), #0FE656 (L5)

## Implementation

### pdf-report.ts

Pure function that takes report data and returns a PDFKit document (stream):

```typescript
interface ReportData {
  entityNameAr: string;
  entityNameEn: string | null;
  submittedAt: string;
  totalScore: number;
  governanceScore: number;
  complianceScore: number;
  maturityLevel: number;
  recommendations: Array<{
    rank: number;
    questionTextAr: string;
    score: number;
    actionAr: string;
    impactAr: string;
    referenceAr: string;
  }>;
}

function generatePdfReport(data: ReportData): PDFKit.PDFDocument
```

The function:
1. Creates a PDFKit document (A4 size)
2. Registers Noto Sans Arabic fonts
3. Draws page 1 (header, entity info, scores, methodology)
4. Adds page 2 (recommendations)
5. Returns the document stream

### assessment.service.ts

New method `getReportData(assessmentId, userId)` that:
1. Validates access (same entity, submitted status)
2. Fetches assessment with scores
3. Fetches entity info
4. Generates recommendations
5. Returns the `ReportData` object

### assessment.controller.ts

New endpoint:
```typescript
@Get(':id/report')
async getReport(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
  const data = await this.assessmentService.getReportData(id, req.user.sub);
  const doc = generatePdfReport(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${referenceNumber}.pdf"`);
  doc.pipe(res);
  doc.end();
}
```

## Frontend Integration

### Download button on results dashboard

In `results-dashboard.tsx`, add a "Download PDF" button in the actions section that opens the report URL in a new tab:

```typescript
window.open(`${apiBaseUrl}/assessments/${assessmentId}/report?token=${token}`, '_blank');
```

Since this is a file download (not a fetch), we pass the token as a query parameter. The API endpoint needs to accept the token from either the Authorization header OR a `token` query parameter.

### assessment-client.ts

Add a helper:
```typescript
export function getReportUrl(assessmentId: string): string {
  const token = localStorage.getItem(authStorage.tokenKey);
  return `${apiBaseUrl}/assessments/${assessmentId}/report?token=${token}`;
}
```

## Dependencies

Add `pdfkit` to `apps/api`:
```bash
cd apps/api && npm install pdfkit && npm install --save-dev @types/pdfkit
```

## Files to Create/Modify

### API
- `apps/api/src/assessment/pdf-report.ts` — new file, PDF generation
- `apps/api/src/assessment/assessment.service.ts` — add `getReportData()` method
- `apps/api/src/assessment/assessment.controller.ts` — add GET /:id/report endpoint with query token support
- `apps/api/assets/fonts/NotoSansArabic-Regular.ttf` — font file
- `apps/api/assets/fonts/NotoSansArabic-Bold.ttf` — font file
- `apps/api/package.json` — add pdfkit dependency

### Web
- `apps/web/components/results-dashboard.tsx` — add download PDF button
- `apps/web/lib/assessment-client.ts` — add `getReportUrl()` helper

## Out of Scope

- Logo image (use text placeholder for now — client provides logo later)
- Digital signature / QR verification
- Multiple language versions (Arabic-primary for MVP)
- Storing generated PDFs on disk
