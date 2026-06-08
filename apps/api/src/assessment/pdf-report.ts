import PDFDocument from 'pdfkit';
import path from 'path';

export interface ReportData {
  entityNameAr: string;
  entityNameEn: string | null;
  submittedAt: string;
  totalScore: number;
  governanceScore: number;
  complianceScore: number;
  maturityLevel: number;
  referenceNumber: string;
  recommendations: Array<{
    rank: number;
    questionTextAr: string;
    score: number;
    actionAr: string;
    impactAr: string;
    referenceAr: string;
  }>;
}

const MATURITY_LABELS: Record<number, { ar: string; en: string }> = {
  1: { ar: 'مبتدئ', en: 'Beginning' },
  2: { ar: 'أساسي', en: 'Basic' },
  3: { ar: 'متوسط', en: 'Intermediate' },
  4: { ar: 'متقدم', en: 'Advanced' },
  5: { ar: 'رائد', en: 'Leading' },
};

const MATURITY_COLORS: Record<number, string> = {
  1: '#E24B4A',
  2: '#EF9F27',
  3: '#ADD378',
  4: '#5DCAA5',
  5: '#0FE656',
};

const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

export function generatePdfReport(data: ReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Environmental Assessment Report - ${data.referenceNumber}`,
      Author: 'National Environmental Maturity Tool',
    },
  });

  // Register fonts
  doc.registerFont('Arabic', path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf'));
  doc.registerFont('Arabic-Bold', path.join(FONTS_DIR, 'NotoSansArabic-Bold.ttf'));

  drawPage1(doc, data);
  doc.addPage();
  drawPage2(doc, data);

  return doc;
}

function drawPage1(doc: PDFKit.PDFDocument, data: ReportData) {
  const pageWidth = doc.page.width - 100; // margins
  const leftMargin = 50;

  // Header band
  doc.rect(0, 0, doc.page.width, 120).fill('#0f3d48');
  doc.rect(0, 120, doc.page.width, 4).fill('#d8b16c');

  doc.font('Arabic-Bold').fontSize(18).fillColor('#ffffff');
  doc.text('الأداة الوطنية لقياس النضج البيئي', leftMargin, 30, { width: pageWidth, align: 'right' });
  doc.font('Arabic').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('National Environmental Maturity Tool', leftMargin, 58, { width: pageWidth, align: 'right' });
  doc.font('Arabic-Bold').fontSize(14).fillColor('#d8b16c');
  doc.text('تقرير التقييم البيئي', leftMargin, 85, { width: pageWidth, align: 'right' });

  // Entity info
  let y = 145;
  doc.fillColor('#17302c');

  doc.font('Arabic-Bold').fontSize(14);
  doc.text(data.entityNameAr, leftMargin, y, { width: pageWidth, align: 'right' });
  y += 22;

  if (data.entityNameEn) {
    doc.font('Arabic').fontSize(10).fillColor('#4d6761');
    doc.text(data.entityNameEn, leftMargin, y, { width: pageWidth, align: 'right' });
    y += 18;
  }

  doc.font('Arabic').fontSize(10).fillColor('#4d6761');
  const dateStr = new Date(data.submittedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`التاريخ: ${dateStr}`, leftMargin, y, { width: pageWidth, align: 'right' });
  y += 16;
  doc.text(`الرقم المرجعي: ${data.referenceNumber}`, leftMargin, y, { width: pageWidth, align: 'right' });
  y += 30;

  // Divider
  doc.rect(leftMargin, y, pageWidth, 1).fill('#e0e8e4');
  y += 20;

  // Total score section
  doc.font('Arabic').fontSize(10).fillColor('#4d6761');
  doc.text('الدرجة الإجمالية', leftMargin, y, { width: pageWidth, align: 'right' });
  y += 18;

  doc.font('Arabic-Bold').fontSize(36).fillColor('#0f6b5b');
  doc.text(`${data.totalScore.toFixed(2)}`, leftMargin, y, { width: pageWidth, align: 'right' });
  y += 44;

  doc.font('Arabic').fontSize(11).fillColor('#4d6761');
  doc.text('/ 100', leftMargin, y - 20, { width: pageWidth - 90, align: 'right' });

  // Maturity level
  const levelLabel = MATURITY_LABELS[data.maturityLevel] ?? MATURITY_LABELS[1];
  const levelColor = MATURITY_COLORS[data.maturityLevel] ?? MATURITY_COLORS[1];

  doc.font('Arabic').fontSize(10).fillColor('#4d6761');
  doc.text('مستوى النضج', leftMargin, y, { width: pageWidth, align: 'right' });
  y += 18;

  doc.font('Arabic-Bold').fontSize(20).fillColor(levelColor);
  doc.text(`${data.maturityLevel} — ${levelLabel.ar} (${levelLabel.en})`, leftMargin, y, { width: pageWidth, align: 'right' });
  y += 36;

  // Divider
  doc.rect(leftMargin, y, pageWidth, 1).fill('#e0e8e4');
  y += 20;

  // Domain scores
  doc.font('Arabic-Bold').fontSize(12).fillColor('#17302c');
  doc.text('درجات المجالات', leftMargin, y, { width: pageWidth, align: 'right' });
  y += 24;

  const colWidth = (pageWidth - 20) / 2;

  // Governance box
  const boxY = y;
  doc.rect(leftMargin, boxY, colWidth, 80).lineWidth(1).strokeColor('#e0e8e4').stroke();
  doc.font('Arabic-Bold').fontSize(11).fillColor('#17302c');
  doc.text('الحوكمة البيئية', leftMargin + 10, boxY + 12, { width: colWidth - 20, align: 'right' });
  doc.font('Arabic-Bold').fontSize(22).fillColor('#0f6b5b');
  doc.text(`${data.governanceScore.toFixed(2)}`, leftMargin + 10, boxY + 32, { width: colWidth - 20, align: 'right' });
  doc.font('Arabic').fontSize(9).fillColor('#4d6761');
  doc.text('/ 100  •  الوزن: 45%', leftMargin + 10, boxY + 58, { width: colWidth - 20, align: 'right' });

  // Compliance box
  const rightBoxX = leftMargin + colWidth + 20;
  doc.rect(rightBoxX, boxY, colWidth, 80).lineWidth(1).strokeColor('#e0e8e4').stroke();
  doc.font('Arabic-Bold').fontSize(11).fillColor('#17302c');
  doc.text('الامتثال التنظيمي', rightBoxX + 10, boxY + 12, { width: colWidth - 20, align: 'right' });
  doc.font('Arabic-Bold').fontSize(22).fillColor('#0f6b5b');
  doc.text(`${data.complianceScore.toFixed(2)}`, rightBoxX + 10, boxY + 32, { width: colWidth - 20, align: 'right' });
  doc.font('Arabic').fontSize(9).fillColor('#4d6761');
  doc.text('/ 100  •  الوزن: 55%', rightBoxX + 10, boxY + 58, { width: colWidth - 20, align: 'right' });

  y = boxY + 100;

  // Methodology section
  doc.rect(leftMargin, y, pageWidth, 1).fill('#e0e8e4');
  y += 20;

  doc.font('Arabic-Bold').fontSize(12).fillColor('#17302c');
  doc.text('المنهجية', leftMargin, y, { width: pageWidth, align: 'right' });
  y += 22;

  doc.font('Arabic').fontSize(9).fillColor('#4d6761');
  const methodLines = [
    'المعادلة: (متوسط الحوكمة × 0.45) + (متوسط الامتثال × 0.55) = الدرجة الإجمالية',
    '18 سؤالاً عبر مجالين — مقياس من 0 إلى 100',
    'المستوى 1: مبتدئ (0-20) | المستوى 2: أساسي (21-40) | المستوى 3: متوسط (41-60) | المستوى 4: متقدم (61-80) | المستوى 5: رائد (81-100)',
  ];
  for (const line of methodLines) {
    doc.text(line, leftMargin, y, { width: pageWidth, align: 'right' });
    y += 16;
  }

  // Footer
  drawFooter(doc, data.referenceNumber, 1);
}

function drawPage2(doc: PDFKit.PDFDocument, data: ReportData) {
  const pageWidth = doc.page.width - 100;
  const leftMargin = 50;

  // Header
  doc.rect(0, 0, doc.page.width, 60).fill('#0f3d48');
  doc.rect(0, 60, doc.page.width, 3).fill('#d8b16c');

  doc.font('Arabic-Bold').fontSize(16).fillColor('#ffffff');
  doc.text('التوصيات الرئيسية', leftMargin, 20, { width: pageWidth, align: 'right' });

  let y = 85;

  for (const rec of data.recommendations) {
    // Rank circle
    doc.font('Arabic-Bold').fontSize(12).fillColor('#d8b16c');
    doc.text(`${rec.rank}.`, leftMargin, y, { width: 30 });

    // Question text
    doc.font('Arabic-Bold').fontSize(11).fillColor('#17302c');
    doc.text(rec.questionTextAr, leftMargin, y, { width: pageWidth, align: 'right' });
    y += doc.heightOfString(rec.questionTextAr, { width: pageWidth }) + 6;

    doc.font('Arabic').fontSize(9).fillColor('#E24B4A');
    doc.text(`الدرجة: ${rec.score} / 100`, leftMargin, y, { width: pageWidth, align: 'right' });
    y += 18;

    // Action
    doc.font('Arabic-Bold').fontSize(9).fillColor('#4d6761');
    doc.text('الإجراء المطلوب:', leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += 14;
    doc.font('Arabic').fontSize(10).fillColor('#17302c');
    doc.text(rec.actionAr, leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += doc.heightOfString(rec.actionAr, { width: pageWidth - 20 }) + 8;

    // Impact
    doc.font('Arabic-Bold').fontSize(9).fillColor('#4d6761');
    doc.text('الأثر المتوقع:', leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += 14;
    doc.font('Arabic').fontSize(10).fillColor('#17302c');
    doc.text(rec.impactAr, leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += doc.heightOfString(rec.impactAr, { width: pageWidth - 20 }) + 8;

    // Reference
    doc.font('Arabic-Bold').fontSize(9).fillColor('#4d6761');
    doc.text('المرجع:', leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += 14;
    doc.font('Arabic').fontSize(10).fillColor('#0f6b5b');
    doc.text(rec.referenceAr, leftMargin + 20, y, { width: pageWidth - 20, align: 'right' });
    y += doc.heightOfString(rec.referenceAr, { width: pageWidth - 20 }) + 20;

    // Divider between recommendations
    if (rec.rank < 3) {
      doc.rect(leftMargin + 20, y, pageWidth - 40, 1).fill('#e0e8e4');
      y += 18;
    }
  }

  drawFooter(doc, data.referenceNumber, 2);
}

function drawFooter(doc: PDFKit.PDFDocument, refNumber: string, pageNum: number) {
  const y = doc.page.height - 40;
  const pageWidth = doc.page.width - 100;
  doc.font('Arabic').fontSize(8).fillColor('#9aada7');
  doc.text(`${refNumber}  •  صفحة ${pageNum} من 2`, 50, y, { width: pageWidth, align: 'center' });
}

export function generateReferenceNumber(submittedAt: string): string {
  const year = new Date(submittedAt).getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ENV-${year}-${random}`;
}
