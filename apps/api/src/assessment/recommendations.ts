import { QUESTIONS } from './questions';

export interface RecommendationRule {
  questionId: string;
  actionAr: string;
  actionEn: string;
  impactAr: string;
  impactEn: string;
  referenceAr: string;
  referenceEn: string;
}

export interface Recommendation {
  rank: number;
  questionId: string;
  score: number;
  questionTextAr: string;
  questionTextEn: string;
  actionAr: string;
  actionEn: string;
  impactAr: string;
  impactEn: string;
  referenceAr: string;
  referenceEn: string;
}

const RULES: RecommendationRule[] = [
  {
    questionId: 'GOV_01',
    actionAr: 'وضع واعتماد سياسة بيئية شاملة وموثقة',
    actionEn: 'Develop and approve a comprehensive documented environmental policy',
    impactAr: 'يُرسي الأساس لجميع الممارسات البيئية ويضمن التزام القيادة',
    impactEn: 'Establishes the foundation for all environmental practices and ensures leadership commitment',
    referenceAr: 'ISO 14001:2015 — البند 5.2',
    referenceEn: 'ISO 14001:2015 — Clause 5.2',
  },
  {
    questionId: 'GOV_02',
    actionAr: 'تعيين مسؤول بيئي مختص أو إنشاء فريق إدارة بيئية',
    actionEn: 'Appoint a dedicated environmental officer or establish an environmental management team',
    impactAr: 'يضمن المساءلة والخبرة المتخصصة في الشؤون البيئية',
    impactEn: 'Ensures accountability and focused expertise for environmental matters',
    referenceAr: 'ISO 14001:2015 — البند 5.3',
    referenceEn: 'ISO 14001:2015 — Clause 5.3',
  },
  {
    questionId: 'GOV_03',
    actionAr: 'دمج الأهداف البيئية في الخطة الاستراتيجية للمنشأة',
    actionEn: 'Integrate environmental objectives into the organization\'s strategic plan',
    impactAr: 'يوائم الأهداف البيئية مع استراتيجية الأعمال ويحسّن تخصيص الموارد',
    impactEn: 'Aligns environmental goals with business strategy, improving resource allocation',
    referenceAr: 'ISO 14001:2015 — البند 6.2',
    referenceEn: 'ISO 14001:2015 — Clause 6.2',
  },
  {
    questionId: 'GOV_04',
    actionAr: 'إنشاء إشراف على مستوى مجلس الإدارة أو القيادة العليا للأداء البيئي',
    actionEn: 'Establish board-level or senior leadership oversight for environmental performance',
    impactAr: 'يعزز الالتزام من القمة ويضمن حصول القضايا البيئية على اهتمام تنفيذي',
    impactEn: 'Drives top-down commitment and ensures environmental issues receive executive attention',
    referenceAr: 'ISO 14001:2015 — البند 5.1',
    referenceEn: 'ISO 14001:2015 — Clause 5.1',
  },
  {
    questionId: 'GOV_05',
    actionAr: 'تخصيص ميزانية سنوية للبرامج البيئية وأنشطة الامتثال',
    actionEn: 'Allocate a dedicated annual budget for environmental programs and compliance activities',
    impactAr: 'يُمكّن من إدارة بيئية استباقية بدلاً من الامتثال التفاعلي',
    impactEn: 'Enables proactive environmental management rather than reactive compliance',
    referenceAr: 'رؤية السعودية 2030 — الاستدامة البيئية',
    referenceEn: 'Saudi Vision 2030 — Environmental Sustainability',
  },
  {
    questionId: 'GOV_06',
    actionAr: 'تنفيذ برامج توعية وتدريب بيئي منتظمة لجميع الموظفين',
    actionEn: 'Implement regular environmental awareness and training programs for all employees',
    impactAr: 'يبني ثقافة بيئية على مستوى المنشأة ويقلل مخالفات الامتثال',
    impactEn: 'Builds organization-wide environmental culture and reduces compliance violations',
    referenceAr: 'ISO 14001:2015 — البند 7.2 و 7.3',
    referenceEn: 'ISO 14001:2015 — Clause 7.2, 7.3',
  },
  {
    questionId: 'GOV_07',
    actionAr: 'إنشاء آلية لإشراك أصحاب المصلحة في القضايا البيئية',
    actionEn: 'Create a stakeholder engagement process for environmental issues',
    impactAr: 'يحسّن الشفافية ويبني الثقة ويحدد المخاطر البيئية مبكراً',
    impactEn: 'Improves transparency, builds trust, and identifies environmental risks early',
    referenceAr: 'ISO 14001:2015 — البند 4.2',
    referenceEn: 'ISO 14001:2015 — Clause 4.2',
  },
  {
    questionId: 'GOV_08',
    actionAr: 'إنشاء برنامج رسمي للتدقيق البيئي الداخلي',
    actionEn: 'Establish a formal internal environmental audit program',
    impactAr: 'يكشف حالات عدم المطابقة قبل أن تصبح مخالفات تنظيمية',
    impactEn: 'Identifies non-conformities before they become regulatory violations',
    referenceAr: 'ISO 14001:2015 — البند 9.2',
    referenceEn: 'ISO 14001:2015 — Clause 9.2',
  },
  {
    questionId: 'GOV_09',
    actionAr: 'تحديد وتتبع مؤشرات الأداء البيئي مع رفع تقارير دورية للإدارة',
    actionEn: 'Define and track environmental KPIs with regular management reporting',
    impactAr: 'يتيح اتخاذ قرارات مبنية على البيانات ويثبت التحسين المستمر',
    impactEn: 'Enables data-driven decision making and demonstrates continuous improvement',
    referenceAr: 'ISO 14001:2015 — البند 9.1',
    referenceEn: 'ISO 14001:2015 — Clause 9.1',
  },
  {
    questionId: 'COM_01',
    actionAr: 'الحصول على جميع التراخيص البيئية المطلوبة من المركز الوطني للرقابة البيئية وضمان تجديدها في الوقت المحدد',
    actionEn: 'Obtain all required NCEC environmental licenses and ensure timely renewal',
    impactAr: 'يمنع إيقاف العمليات والعقوبات التنظيمية',
    impactEn: 'Prevents operational shutdowns and regulatory penalties',
    referenceAr: 'أنظمة التراخيص البيئية — المركز الوطني للرقابة البيئية',
    referenceEn: 'NCEC Environmental Licensing Regulations',
  },
  {
    questionId: 'COM_02',
    actionAr: 'إجراء تدقيق امتثال للمياه والصرف وفقاً لأنظمة وزارة البيئة والمياه والزراعة',
    actionEn: 'Conduct a water and wastewater compliance audit against MEWA regulations',
    impactAr: 'يضمن الامتثال القانوني ويقلل مخاطر مخالفات الموارد المائية',
    impactEn: 'Ensures legal compliance and reduces risk of water resource violations',
    referenceAr: 'أنظمة المياه والصرف — وزارة البيئة والمياه والزراعة',
    referenceEn: 'MEWA Water and Wastewater Regulations',
  },
  {
    questionId: 'COM_03',
    actionAr: 'تطبيق إجراءات تقييم الأثر البيئي لجميع المشاريع الجديدة',
    actionEn: 'Implement environmental impact assessment procedures for all new projects',
    impactAr: 'يمنع تكاليف المعالجة المكلفة ويضمن الموافقة التنظيمية للأنشطة الجديدة',
    impactEn: 'Prevents costly remediation and ensures regulatory approval for new activities',
    referenceAr: 'أنظمة تقييم الأثر البيئي — المملكة العربية السعودية',
    referenceEn: 'Saudi Environmental Impact Assessment Regulations',
  },
  {
    questionId: 'COM_04',
    actionAr: 'تطوير نظام إدارة نفايات موثق يشمل التصنيف والمناولة والتخلص',
    actionEn: 'Develop a documented waste management system covering classification, handling, and disposal',
    impactAr: 'يقلل المسؤولية البيئية ويضمن التتبع السليم للنفايات',
    impactEn: 'Reduces environmental liability and ensures proper waste tracking',
    referenceAr: 'أنظمة إدارة النفايات — المركز الوطني للرقابة البيئية',
    referenceEn: 'Saudi Waste Management Regulations — NCEC',
  },
  {
    questionId: 'COM_05',
    actionAr: 'تركيب أجهزة مراقبة الانبعاثات الهوائية ووضع إجراءات إبلاغ منتظمة',
    actionEn: 'Install air emissions monitoring equipment and establish regular reporting procedures',
    impactAr: 'يضمن الامتثال لمعايير جودة الهواء ويتجنب العقوبات',
    impactEn: 'Ensures compliance with air quality standards and avoids penalties',
    referenceAr: 'أنظمة معايير جودة الهواء والانبعاثات — المركز الوطني للرقابة البيئية',
    referenceEn: 'NCEC Air Quality Standards and Emissions Regulations',
  },
  {
    questionId: 'COM_06',
    actionAr: 'مراجعة وتحديث إجراءات مناولة المواد الخطرة وتخزينها والتخلص منها',
    actionEn: 'Review and update hazardous materials handling, storage, and disposal procedures',
    impactAr: 'يمنع التلوث البيئي ويضمن سلامة العاملين',
    impactEn: 'Prevents environmental contamination and ensures worker safety',
    referenceAr: 'أنظمة إدارة المواد الخطرة — المركز الوطني للرقابة البيئية',
    referenceEn: 'NCEC Hazardous Materials Management Regulations',
  },
  {
    questionId: 'COM_07',
    actionAr: 'البدء بتطبيق ISO 14001 أو تبني نظام إدارة بيئية معادل',
    actionEn: 'Begin ISO 14001 implementation or adopt an equivalent environmental management system',
    impactAr: 'يوفر إطاراً منهجياً لإدارة المسؤوليات البيئية',
    impactEn: 'Provides a systematic framework for managing environmental responsibilities',
    referenceAr: 'ISO 14001:2015 — المعيار الكامل',
    referenceEn: 'ISO 14001:2015 — Full Standard',
  },
  {
    questionId: 'COM_08',
    actionAr: 'إجراء تفتيشات تنظيمية وهمية والحفاظ على وثائق جاهزة للتفتيش',
    actionEn: 'Conduct mock regulatory inspections and maintain inspection-ready documentation',
    impactAr: 'يقلل مخاطر نتائج عدم الامتثال أثناء عمليات التفتيش الفعلية',
    impactEn: 'Reduces risk of non-compliance findings during actual inspections',
    referenceAr: 'إجراءات التفتيش والإنفاذ — المركز الوطني للرقابة البيئية',
    referenceEn: 'NCEC Inspection and Enforcement Procedures',
  },
  {
    questionId: 'COM_09',
    actionAr: 'وضع وتوثيق إجراءات الإبلاغ عن الحوادث البيئية والاستجابة لها',
    actionEn: 'Develop and document environmental incident reporting and response procedures',
    impactAr: 'يضمن الاستجابة السريعة للحوادث ويلبي متطلبات الإخطار التنظيمي',
    impactEn: 'Ensures timely response to incidents and meets regulatory notification requirements',
    referenceAr: 'أنظمة الإبلاغ عن الحوادث البيئية — المركز الوطني للرقابة البيئية',
    referenceEn: 'NCEC Environmental Incident Reporting Regulations',
  },
];

const RULES_MAP = new Map(RULES.map((r) => [r.questionId, r]));

interface AnswerInput {
  questionId: string;
  score: number;
}

export function generateRecommendations(answers: AnswerInput[]): Recommendation[] {
  const sorted = [...answers].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // On tie, prefer compliance (higher weight) over governance
    const aIsCompliance = a.questionId.startsWith('COM') ? 0 : 1;
    const bIsCompliance = b.questionId.startsWith('COM') ? 0 : 1;
    return aIsCompliance - bIsCompliance;
  });

  const top3 = sorted.slice(0, 3);

  return top3.map((answer, index) => {
    const rule = RULES_MAP.get(answer.questionId);
    const question = QUESTIONS.find((q) => q.id === answer.questionId);

    return {
      rank: index + 1,
      questionId: answer.questionId,
      score: answer.score,
      questionTextAr: question?.textAr ?? '',
      questionTextEn: question?.textEn ?? '',
      actionAr: rule?.actionAr ?? '',
      actionEn: rule?.actionEn ?? '',
      impactAr: rule?.impactAr ?? '',
      impactEn: rule?.impactEn ?? '',
      referenceAr: rule?.referenceAr ?? '',
      referenceEn: rule?.referenceEn ?? '',
    };
  });
}
