export interface AnswerOption {
  score: number;
  labelAr: string;
  labelEn: string;
}

export interface Question {
  id: string;
  domain: 'governance' | 'compliance';
  textAr: string;
  textEn: string;
}

export interface Domain {
  id: 'governance' | 'compliance';
  nameAr: string;
  nameEn: string;
  weight: number;
}

export const DOMAINS: Domain[] = [
  { id: 'governance', nameAr: 'الحوكمة البيئية', nameEn: 'Environmental Governance', weight: 0.45 },
  { id: 'compliance', nameAr: 'الامتثال التنظيمي', nameEn: 'Regulatory Compliance', weight: 0.55 },
];

export const ANSWER_OPTIONS: AnswerOption[] = [
  { score: 0, labelAr: 'لا يوجد', labelEn: 'Does not exist' },
  { score: 25, labelAr: 'في مرحلة التخطيط', labelEn: 'In planning stage' },
  { score: 50, labelAr: 'مطبّق جزئيًا', labelEn: 'Partially implemented' },
  { score: 75, labelAr: 'مطبّق بشكل كبير', labelEn: 'Largely implemented' },
  { score: 100, labelAr: 'مطبّق بالكامل ومُراجَع دوريًا', labelEn: 'Fully implemented and periodically reviewed' },
];

export const VALID_SCORES = ANSWER_OPTIONS.map((o) => o.score);

export const QUESTIONS: Question[] = [
  { id: 'GOV_01', domain: 'governance', textAr: 'هل لدى منشأتكم سياسة بيئية موثقة ومعتمدة؟', textEn: 'Does your organization have a documented and approved environmental policy?' },
  { id: 'GOV_02', domain: 'governance', textAr: 'هل يوجد فريق أو مسؤول مختص بالإدارة البيئية؟', textEn: 'Is there a dedicated environmental management team or officer?' },
  { id: 'GOV_03', domain: 'governance', textAr: 'هل تم دمج الأهداف البيئية في التخطيط الاستراتيجي للمنشأة؟', textEn: 'Are environmental objectives integrated into the organization\'s strategic planning?' },
  { id: 'GOV_04', domain: 'governance', textAr: 'هل يقوم مجلس الإدارة أو القيادة العليا بالإشراف على الشؤون البيئية؟', textEn: 'Does the board or senior leadership provide oversight on environmental matters?' },
  { id: 'GOV_05', domain: 'governance', textAr: 'هل توجد ميزانية مخصصة للبرامج البيئية والامتثال؟', textEn: 'Is there a dedicated budget allocated for environmental programs and compliance?' },
  { id: 'GOV_06', domain: 'governance', textAr: 'هل توفر المنشأة برامج تدريب وتوعية بيئية للموظفين؟', textEn: 'Does the organization provide environmental awareness training for employees?' },
  { id: 'GOV_07', domain: 'governance', textAr: 'هل توجد آلية لإشراك أصحاب المصلحة في القضايا البيئية؟', textEn: 'Is there a process for engaging stakeholders on environmental issues?' },
  { id: 'GOV_08', domain: 'governance', textAr: 'هل تجري المنشأة عمليات تدقيق بيئي داخلية؟', textEn: 'Does the organization conduct internal environmental audits?' },
  { id: 'GOV_09', domain: 'governance', textAr: 'هل يتم تتبع مؤشرات الأداء البيئي ورفعها للإدارة؟', textEn: 'Are environmental KPIs tracked and reported to management?' },
  { id: 'COM_01', domain: 'compliance', textAr: 'هل تمتلك منشأتكم جميع التراخيص والتصاريح البيئية المطلوبة من المركز الوطني للرقابة البيئية؟', textEn: 'Does your organization hold all required NCEC environmental licenses and permits?' },
  { id: 'COM_02', domain: 'compliance', textAr: 'هل تلتزم المنشأة بأنظمة وزارة البيئة والمياه والزراعة المتعلقة بالمياه والصرف؟', textEn: 'Is the organization compliant with MEWA water and wastewater regulations?' },
  { id: 'COM_03', domain: 'compliance', textAr: 'هل تجري المنشأة تقييمات الأثر البيئي للمشاريع الجديدة؟', textEn: 'Does the organization conduct environmental impact assessments for new projects?' },
  { id: 'COM_04', domain: 'compliance', textAr: 'هل يوجد نظام إدارة نفايات موثق ومتوافق مع المتطلبات التنظيمية؟', textEn: 'Is there a documented waste management system compliant with regulatory requirements?' },
  { id: 'COM_05', domain: 'compliance', textAr: 'هل تراقب المنشأة انبعاثاتها الهوائية وتبلغ عنها وفقًا للأنظمة؟', textEn: 'Does the organization monitor and report air emissions as required by regulations?' },
  { id: 'COM_06', domain: 'compliance', textAr: 'هل يتم التعامل مع المواد الخطرة وتخزينها والتخلص منها وفقًا للأنظمة؟', textEn: 'Are hazardous materials handled, stored, and disposed of according to regulations?' },
  { id: 'COM_07', domain: 'compliance', textAr: 'هل تبنت المنشأة نظام إدارة بيئية ISO 14001 أو ما يعادله؟', textEn: 'Has the organization adopted ISO 14001 or an equivalent environmental management system?' },
  { id: 'COM_08', domain: 'compliance', textAr: 'هل المنشأة مستعدة للتفتيش التنظيمي في أي وقت؟', textEn: 'Is the organization prepared for regulatory inspections at any time?' },
  { id: 'COM_09', domain: 'compliance', textAr: 'هل توجد إجراءات موثقة للإبلاغ عن الحوادث البيئية؟', textEn: 'Are there documented procedures for reporting environmental incidents?' },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
export const TOTAL_QUESTIONS = QUESTIONS.length;

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
