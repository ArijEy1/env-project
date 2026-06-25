import PDFDocument from 'pdfkit';
import path from 'path';
import {
  arLabel,
  EFFORT_AR,
  ENTITY_TYPE_AR,
  EXPOSURE_AR,
  MATURITY_AR,
  SECTOR_AR,
} from './labels';
import type { EngineRecommendation } from './recommendation-engine.service';

interface ResultsLike {
  totalScore: number;
  maturityLevel: number;
  submittedAt: string | null;
  domains: Array<{ nameAr: string; score: number; maturity: number }>;
  profile: {
    sector: string | null;
    entityType: string | null;
    environmentalExposure: string | null;
    employeeCountBracket: string | null;
  };
}

/** Shapes the engine results + recommendations into the Arabic ReportData. */
export function buildReportData(
  entityNameAr: string,
  results: ResultsLike,
  recommendations: EngineRecommendation[],
): ReportData {
  return {
    entityNameAr,
    submittedAt: results.submittedAt ?? new Date().toISOString(),
    referenceNumber: '', // filled in by the controller
    totalScore: results.totalScore,
    maturityLevel: results.maturityLevel,
    maturityLabelAr: MATURITY_AR[results.maturityLevel] ?? '',
    profile: {
      entityTypeAr: arLabel(ENTITY_TYPE_AR, results.profile.entityType),
      sectorAr: arLabel(SECTOR_AR, results.profile.sector),
      // The Arabic font has no "+" glyph; spell it out.
      sizeLabel:
        results.profile.employeeCountBracket === '1000+'
          ? '1000 فأكثر'
          : results.profile.employeeCountBracket ?? 'غير محدد',
      exposureAr: arLabel(EXPOSURE_AR, results.profile.environmentalExposure),
    },
    domains: results.domains.map((d) => ({
      nameAr: d.nameAr,
      score: d.score,
      maturity: d.maturity,
    })),
    recommendations: recommendations.map((r) => ({
      rank: r.rank,
      questionTextAr: r.questionTextAr,
      currentScore: r.currentScore,
      immediateActionAr: r.immediateActionAr,
      shortTermActionAr: r.shortTermActionAr,
      mediumTermActionAr: r.mediumTermActionAr,
      costEstimate: r.costEstimate,
      effortAr: arLabel(EFFORT_AR, r.effortLevel),
      scoreImpactPoints: r.scoreImpactPoints,
      timelineWeeks: r.timelineWeeks,
      legalReference: r.legalReference,
      isCompliance: r.isCompliance,
    })),
  };
}

export interface ReportDomain {
  nameAr: string;
  score: number;
  maturity: number;
}

export interface ReportRecommendation {
  rank: number;
  questionTextAr: string;
  currentScore: number;
  immediateActionAr: string;
  shortTermActionAr: string;
  mediumTermActionAr: string;
  costEstimate: string | null; // may be Latin -> rendered with the Latin font
  effortAr: string;
  scoreImpactPoints: number;
  timelineWeeks: number;
  legalReference: string | null; // may be Latin
  isCompliance: boolean;
}

export interface ReportData {
  entityNameAr: string;
  submittedAt: string;
  referenceNumber: string;
  totalScore: number;
  maturityLevel: number;
  maturityLabelAr: string;
  profile: {
    entityTypeAr: string;
    sectorAr: string;
    sizeLabel: string;
    exposureAr: string;
  };
  domains: ReportDomain[];
  recommendations: ReportRecommendation[];
}

const MATURITY_COLORS: Record<number, string> = {
  1: '#E24B4A',
  2: '#EF9F27',
  3: '#9bbf56',
  4: '#3fa888',
  5: '#0f8a5f',
};

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const TEAL = '#0f3d48';
const GOLD = '#d8b16c';
const GREEN = '#0f6b5b';
const INK = '#17302c';
const MUTE = '#4d6761';
const LINE = '#e0e8e4';
const PAGE_MARGIN = 50;

export function generatePdfReport(data: ReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    info: {
      Title: `Environmental Assessment Report - ${data.referenceNumber}`,
      Author: 'National Environmental Maturity Tool',
    },
  });

  doc.registerFont('AR', path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf'));
  doc.registerFont('AR-B', path.join(FONTS_DIR, 'NotoSansArabic-Bold.ttf'));
  // Helvetica is a built-in PDF font; used only for Latin tokens (ref number,
  // cost ranges, acronyms) the Arabic font has no glyphs for.
  // 'Helvetica' / 'Helvetica-Bold' are available without registration.

  drawPage1(doc, data);
  doc.addPage();
  drawPage2(doc, data);

  return doc;
}

// --- text helpers ---

function ar(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  opts: { size?: number; bold?: boolean; color?: string; align?: 'right' | 'center' | 'left' } = {},
) {
  doc
    .font(opts.bold ? 'AR-B' : 'AR')
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? INK)
    .text(text, x, y, { width, align: opts.align ?? 'right' });
}

function lat(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  opts: { size?: number; bold?: boolean; color?: string; align?: 'right' | 'center' | 'left' } = {},
) {
  doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? MUTE)
    .text(text, x, y, { width, align: opts.align ?? 'right' });
}

function formatDateAr(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

// --- pages ---

function drawPage1(doc: PDFKit.PDFDocument, data: ReportData) {
  const W = doc.page.width - PAGE_MARGIN * 2;
  const x = PAGE_MARGIN;

  // Header band
  doc.rect(0, 0, doc.page.width, 110).fill(TEAL);
  doc.rect(0, 110, doc.page.width, 4).fill(GOLD);
  ar(doc, 'الأداة الوطنية لقياس النضج البيئي', x, 34, W, { size: 19, bold: true, color: '#ffffff' });
  ar(doc, 'تقرير التقييم البيئي', x, 70, W, { size: 13, bold: true, color: GOLD });

  let y = 134;

  // Entity + meta
  ar(doc, data.entityNameAr, x, y, W, { size: 15, bold: true, color: INK });
  y += 24;
  ar(doc, `التاريخ: ${formatDateAr(data.submittedAt)}`, x, y, W, { size: 10, color: MUTE });
  y += 16;
  // Reference number is Latin -> Helvetica, right-aligned
  ar(doc, 'الرقم المرجعي', x, y, W, { size: 10, color: MUTE });
  lat(doc, data.referenceNumber, x, y + 13, W, { size: 9, color: MUTE });
  y += 38;

  doc.rect(x, y, W, 1).fill(LINE);
  y += 18;

  // Total score + maturity (two columns)
  const colW = (W - 20) / 2;
  const scoreBoxY = y;

  // left col: total score
  ar(doc, 'الدرجة الإجمالية', x, scoreBoxY, colW, { size: 10, color: MUTE });
  ar(doc, `${data.totalScore.toFixed(2)}`, x, scoreBoxY + 16, colW, { size: 40, bold: true, color: GREEN });
  ar(doc, 'من 100', x, scoreBoxY + 64, colW, { size: 10, color: MUTE });

  // right col: maturity
  const rx = x + colW + 20;
  const levelColor = MATURITY_COLORS[data.maturityLevel] ?? MATURITY_COLORS[1];
  ar(doc, 'مستوى النضج', rx, scoreBoxY, colW, { size: 10, color: MUTE });
  ar(doc, `${data.maturityLevel}`, rx, scoreBoxY + 16, colW, { size: 40, bold: true, color: levelColor });
  ar(doc, data.maturityLabelAr, rx, scoreBoxY + 64, colW, { size: 12, bold: true, color: levelColor });

  y = scoreBoxY + 92;
  doc.rect(x, y, W, 1).fill(LINE);
  y += 18;

  // Profile summary
  ar(doc, 'ملف المنشأة', x, y, W, { size: 12, bold: true, color: INK });
  y += 22;
  const prof = [
    ['نوع المنشأة', data.profile.entityTypeAr],
    ['القطاع', data.profile.sectorAr],
    ['حجم المنشأة', data.profile.sizeLabel],
    ['مستوى التعرض البيئي', data.profile.exposureAr],
  ];
  const pColW = (W - 30) / 4;
  prof.forEach(([label, value], i) => {
    const px = x + (3 - i) * (pColW + 10); // right-to-left placement
    doc.rect(px, y, pColW, 50).fill('#f5f9f7');
    ar(doc, label, px + 6, y + 9, pColW - 12, { size: 8, color: MUTE, align: 'center' });
    ar(doc, value, px + 6, y + 24, pColW - 12, { size: 10, bold: true, color: INK, align: 'center' });
  });
  y += 70;

  // Domain cards (6, 2 columns)
  ar(doc, 'درجات المجالات', x, y, W, { size: 12, bold: true, color: INK });
  y += 22;

  const cardW = (W - 16) / 2;
  const cardH = 66;
  data.domains.forEach((d, i) => {
    const col = i % 2; // 0 = right, 1 = left (RTL: first card on the right)
    const row = Math.floor(i / 2);
    const cx = col === 0 ? x + cardW + 16 : x;
    const cy = y + row * (cardH + 12);
    const dColor = MATURITY_COLORS[d.maturity] ?? MATURITY_COLORS[1];

    doc.roundedRect(cx, cy, cardW, cardH, 8).lineWidth(1).strokeColor(LINE).stroke();
    ar(doc, d.nameAr, cx + 10, cy + 10, cardW - 20, { size: 10, bold: true, color: INK });
    ar(doc, `${d.score.toFixed(1)}`, cx + 10, cy + 28, cardW - 20, { size: 18, bold: true, color: GREEN });
    ar(doc, `المستوى ${d.maturity}`, cx + 10, cy + 28, cardW - 20, { size: 9, color: dColor, align: 'left' });
    // score bar
    const barY = cy + cardH - 12;
    doc.roundedRect(cx + 10, barY, cardW - 20, 5, 2).fill('#eef3f1');
    doc.roundedRect(cx + 10, barY, (cardW - 20) * (d.score / 100), 5, 2).fill(dColor);
  });

  drawFooter(doc, data.referenceNumber, 1);
}

function recHeight(doc: PDFKit.PDFDocument, rec: ReportRecommendation, W: number): number {
  let h = 0;
  doc.font('AR-B').fontSize(11);
  h += doc.heightOfString(`${rec.rank}. ${rec.questionTextAr}`, { width: W }) + 4;
  h += 18; // tags line
  for (const action of [rec.immediateActionAr, rec.shortTermActionAr, rec.mediumTermActionAr]) {
    h += 13;
    doc.font('AR').fontSize(10);
    h += doc.heightOfString(action, { width: W - 14 }) + 7;
  }
  h += 16; // meta
  if (rec.costEstimate) h += 28;
  if (rec.legalReference) h += 28;
  h += 18; // divider + gap
  return h;
}

function drawPage2(doc: PDFKit.PDFDocument, data: ReportData) {
  const W = doc.page.width - PAGE_MARGIN * 2;
  const x = PAGE_MARGIN;
  let pageNum = 2;

  const drawHeaderBand = (full: boolean) => {
    doc.rect(0, 0, doc.page.width, full ? 56 : 40).fill(TEAL);
    doc.rect(0, full ? 56 : 40, doc.page.width, 3).fill(GOLD);
    ar(doc, 'خطة التحسين والتوصيات', x, full ? 20 : 12, W, { size: full ? 15 : 12, bold: true, color: '#ffffff' });
  };

  drawHeaderBand(true);
  let y = 80;
  const bottom = doc.page.height - 55;

  if (data.recommendations.length === 0) {
    ar(doc, 'لا توجد توصيات — جميع المجالات ضمن المستوى المطلوب.', x, y, W, { size: 11, color: MUTE });
    drawFooter(doc, data.referenceNumber, pageNum);
    return;
  }

  const nextPage = () => {
    drawFooter(doc, data.referenceNumber, pageNum);
    doc.addPage();
    pageNum += 1;
    drawHeaderBand(false);
    y = 60;
  };

  for (const rec of data.recommendations) {
    if (y + recHeight(doc, rec, W) > bottom) nextPage();

    ar(doc, `${rec.rank}. ${rec.questionTextAr}`, x, y, W, { size: 11, bold: true, color: INK });
    doc.font('AR-B').fontSize(11);
    y += doc.heightOfString(`${rec.rank}. ${rec.questionTextAr}`, { width: W }) + 4;

    const tags = [`الدرجة الحالية: ${rec.currentScore} من 100`];
    if (rec.isCompliance) tags.unshift('أولوية امتثال');
    ar(doc, tags.join('،  '), x, y, W, { size: 9, color: rec.isCompliance ? '#c0392b' : MUTE });
    y += 18;

    const tiers: Array<[string, string]> = [
      ['إجراء فوري', rec.immediateActionAr],
      ['إجراء قصير المدى', rec.shortTermActionAr],
      ['إجراء متوسط المدى', rec.mediumTermActionAr],
    ];
    for (const [label, action] of tiers) {
      ar(doc, label, x, y, W, { size: 9, bold: true, color: GREEN });
      y += 13;
      ar(doc, action, x + 14, y, W - 14, { size: 10, color: INK });
      doc.font('AR').fontSize(10);
      y += doc.heightOfString(action, { width: W - 14 }) + 7;
    }

    ar(
      doc,
      `الأثر المتوقع: ${rec.scoreImpactPoints} نقاط،  المدة: ${rec.timelineWeeks} أسبوعًا،  الجهد: ${rec.effortAr}`,
      x, y, W, { size: 9, color: MUTE },
    );
    y += 16;

    if (rec.costEstimate) {
      ar(doc, 'التكلفة التقديرية:', x, y, W * 0.45, { size: 9, bold: true, color: MUTE });
      lat(doc, rec.costEstimate, x + W * 0.45, y, W * 0.55, { size: 9, color: INK, align: 'left' });
      y += 16;
    }
    if (rec.legalReference) {
      ar(doc, 'المرجع:', x, y, W * 0.3, { size: 9, bold: true, color: MUTE });
      lat(doc, rec.legalReference, x + W * 0.3, y, W * 0.7, { size: 9, color: GREEN, align: 'left' });
      y += 16;
    }

    doc.rect(x, y, W, 1).fill(LINE);
    y += 18;
  }

  drawFooter(doc, data.referenceNumber, pageNum);
}

function drawFooter(doc: PDFKit.PDFDocument, refNumber: string, pageNum: number) {
  // Temporarily drop the bottom margin so footer text below maxY does not
  // trigger pdfkit's auto-pagination (which spawns blank pages).
  const prevBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 34;
  const W = doc.page.width - PAGE_MARGIN * 2;
  lat(doc, `${refNumber}`, PAGE_MARGIN, y, W / 2, { size: 8, color: '#9aada7', align: 'left' });
  ar(doc, `صفحة ${pageNum}`, PAGE_MARGIN + W / 2, y, W / 2, { size: 8, color: '#9aada7', align: 'right' });
  doc.page.margins.bottom = prevBottom;
}

export function generateReferenceNumber(submittedAt: string): string {
  const year = new Date(submittedAt).getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ENV-${year}-${random}`;
}
