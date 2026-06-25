/**
 * DRAFT engine content — placeholder taxonomy + question bank seeded when the
 * corresponding tables are empty. All of this is meant to be REPLACED by the
 * client's official content via the admin backoffice (no code change). IDs are
 * stable string codes so references stay readable and seeding is idempotent.
 *
 * See docs/assessment-engine-design.md.
 */

export interface DraftDomain {
  id: string; // D1..D6
  nameAr: string;
  nameEn: string;
  displayOrder: number;
}

export interface DraftMaterialityTopic {
  id: string; // code
  nameAr: string;
  nameEn: string;
  domainId: string;
}

export interface DraftQuestion {
  id: string; // code, e.g. GOV_01
  domainId: string;
  textAr: string;
  textEn: string;
  helpTextAr: string | null;
  helpTextEn: string | null;
  materialityTopicId: string | null;
  baseWeight: number;
  calculatorType: string | null; // 'scope12' | 'resource_efficiency' | null
  // null/absent fields apply to all profiles.
  applicability: {
    sectors?: string[];
    entityTypes?: string[];
    exposureMin?: 'low' | 'medium' | 'high';
    sizeMin?: string;
  };
}

export interface DraftMaterialityWeight {
  dimension: 'sector' | 'exposure' | 'entity_type' | 'size';
  dimensionValue: string;
  materialityTopicId: string;
  multiplier: number;
}

export interface DraftScoringConfig {
  id: string;
  name: string;
  domainWeights: Record<string, number>;
}

export interface DraftRecommendation {
  id: string;
  materialityTopicId: string;
  domainId: string;
  triggerMaxScore: number; // recommend when a question's score <= this
  immediateActionAr: string;
  immediateActionEn: string;
  shortTermActionAr: string;
  shortTermActionEn: string;
  mediumTermActionAr: string;
  mediumTermActionEn: string;
  costEstimate: string;
  effortLevel: 'low' | 'medium' | 'high';
  scoreImpactPoints: number;
  timelineWeeks: number;
  legalReference: string;
}

export interface DraftRegulatoryMapping {
  bankQuestionId: string;
  regulation: string;
  clause: string;
  authority: string;
  url: string | null;
}

export interface DraftGlossaryTerm {
  termAr: string;
  termEn: string | null;
  definitionAr: string;
  definitionEn: string | null;
  category: string | null;
}

export const DRAFT_DOMAINS: DraftDomain[] = [
  { id: 'D1', nameAr: 'الحوكمة والاستراتيجية البيئية', nameEn: 'Environmental Governance & Strategy', displayOrder: 1 },
  { id: 'D2', nameAr: 'الامتثال التنظيمي', nameEn: 'Regulatory Compliance', displayOrder: 2 },
  { id: 'D3', nameAr: 'الانبعاثات والمناخ', nameEn: 'Emissions & Climate', displayOrder: 3 },
  { id: 'D4', nameAr: 'كفاءة الموارد', nameEn: 'Resource Efficiency', displayOrder: 4 },
  { id: 'D5', nameAr: 'النفايات والاقتصاد الدائري', nameEn: 'Waste & Circular Economy', displayOrder: 5 },
  { id: 'D6', nameAr: 'الإفصاح وأصحاب المصلحة', nameEn: 'Disclosure & Stakeholders', displayOrder: 6 },
];

export const DRAFT_MATERIALITY_TOPICS: DraftMaterialityTopic[] = [
  { id: 'governance_policy', nameAr: 'السياسة والحوكمة', nameEn: 'Policy & Governance', domainId: 'D1' },
  { id: 'strategy_integration', nameAr: 'تكامل الاستراتيجية', nameEn: 'Strategy Integration', domainId: 'D1' },
  { id: 'compliance_permits', nameAr: 'التراخيص والامتثال', nameEn: 'Permits & Compliance', domainId: 'D2' },
  { id: 'regulatory_reporting', nameAr: 'الإبلاغ التنظيمي', nameEn: 'Regulatory Reporting', domainId: 'D2' },
  { id: 'ghg_emissions', nameAr: 'انبعاثات الغازات الدفيئة', nameEn: 'GHG Emissions', domainId: 'D3' },
  { id: 'air_quality', nameAr: 'جودة الهواء', nameEn: 'Air Quality', domainId: 'D3' },
  { id: 'energy_use', nameAr: 'استهلاك الطاقة', nameEn: 'Energy Use', domainId: 'D4' },
  { id: 'water_management', nameAr: 'إدارة المياه', nameEn: 'Water Management', domainId: 'D4' },
  { id: 'waste_hazardous', nameAr: 'النفايات والمواد الخطرة', nameEn: 'Waste & Hazardous Materials', domainId: 'D5' },
  { id: 'circular_economy', nameAr: 'الاقتصاد الدائري', nameEn: 'Circular Economy', domainId: 'D5' },
  { id: 'disclosure_reporting', nameAr: 'الإفصاح والتقارير', nameEn: 'Disclosure & Reporting', domainId: 'D6' },
  { id: 'stakeholder_engagement', nameAr: 'إشراك أصحاب المصلحة', nameEn: 'Stakeholder Engagement', domainId: 'D6' },
];

const all = {}; // applies to every profile

export const DRAFT_QUESTION_BANK: DraftQuestion[] = [
  // D1 — Governance (reuses the launch question text)
  { id: 'GOV_01', domainId: 'D1', textAr: 'هل لدى منشأتكم سياسة بيئية موثقة ومعتمدة؟', textEn: 'Does your organization have a documented and approved environmental policy?', helpTextAr: 'سياسة معتمدة من الإدارة العليا وموثقة رسميًا.', helpTextEn: 'A formally documented policy approved by senior management.', materialityTopicId: 'governance_policy', baseWeight: 1.2, calculatorType: null, applicability: all },
  { id: 'GOV_02', domainId: 'D1', textAr: 'هل يوجد فريق أو مسؤول مختص بالإدارة البيئية؟', textEn: 'Is there a dedicated environmental management team or officer?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'governance_policy', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'GOV_03', domainId: 'D1', textAr: 'هل تم دمج الأهداف البيئية في التخطيط الاستراتيجي للمنشأة؟', textEn: "Are environmental objectives integrated into the organization's strategic planning?", helpTextAr: null, helpTextEn: null, materialityTopicId: 'strategy_integration', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'GOV_04', domainId: 'D1', textAr: 'هل يقوم مجلس الإدارة أو القيادة العليا بالإشراف على الشؤون البيئية؟', textEn: 'Does the board or senior leadership provide oversight on environmental matters?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'governance_policy', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'GOV_05', domainId: 'D1', textAr: 'هل توجد ميزانية مخصصة للبرامج البيئية والامتثال؟', textEn: 'Is there a dedicated budget allocated for environmental programs and compliance?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'strategy_integration', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'GOV_06', domainId: 'D1', textAr: 'هل توفر المنشأة برامج تدريب وتوعية بيئية للموظفين؟', textEn: 'Does the organization provide environmental awareness training for employees?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'governance_policy', baseWeight: 0.8, calculatorType: null, applicability: all },
  { id: 'GOV_07', domainId: 'D1', textAr: 'هل توجد آلية لإشراك أصحاب المصلحة في القضايا البيئية؟', textEn: 'Is there a process for engaging stakeholders on environmental issues?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'strategy_integration', baseWeight: 0.8, calculatorType: null, applicability: all },
  { id: 'GOV_08', domainId: 'D1', textAr: 'هل تجري المنشأة عمليات تدقيق بيئي داخلية؟', textEn: 'Does the organization conduct internal environmental audits?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'governance_policy', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'GOV_09', domainId: 'D1', textAr: 'هل يتم تتبع مؤشرات الأداء البيئي ورفعها للإدارة؟', textEn: 'Are environmental KPIs tracked and reported to management?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'strategy_integration', baseWeight: 1.0, calculatorType: null, applicability: all },

  // D2 — Regulatory Compliance
  { id: 'COM_01', domainId: 'D2', textAr: 'هل تمتلك منشأتكم جميع التراخيص والتصاريح البيئية المطلوبة من المركز الوطني للرقابة البيئية؟', textEn: 'Does your organization hold all required NCEC environmental licenses and permits?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'compliance_permits', baseWeight: 1.5, calculatorType: null, applicability: all },
  { id: 'COM_02', domainId: 'D2', textAr: 'هل تلتزم المنشأة بأنظمة وزارة البيئة والمياه والزراعة المتعلقة بالمياه والصرف؟', textEn: 'Is the organization compliant with MEWA water and wastewater regulations?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'compliance_permits', baseWeight: 1.3, calculatorType: null, applicability: all },
  { id: 'COM_03', domainId: 'D2', textAr: 'هل تجري المنشأة تقييمات الأثر البيئي للمشاريع الجديدة؟', textEn: 'Does the organization conduct environmental impact assessments for new projects?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'compliance_permits', baseWeight: 1.2, calculatorType: null, applicability: all },
  { id: 'COM_04', domainId: 'D2', textAr: 'هل يوجد نظام إدارة نفايات موثق ومتوافق مع المتطلبات التنظيمية؟', textEn: 'Is there a documented waste management system compliant with regulatory requirements?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'regulatory_reporting', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'COM_05', domainId: 'D2', textAr: 'هل تراقب المنشأة انبعاثاتها الهوائية وتبلغ عنها وفقًا للأنظمة؟', textEn: 'Does the organization monitor and report air emissions as required by regulations?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'regulatory_reporting', baseWeight: 1.2, calculatorType: null, applicability: all },
  { id: 'COM_06', domainId: 'D2', textAr: 'هل يتم التعامل مع المواد الخطرة وتخزينها والتخلص منها وفقًا للأنظمة؟', textEn: 'Are hazardous materials handled, stored, and disposed of according to regulations?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'compliance_permits', baseWeight: 1.2, calculatorType: null, applicability: all },
  { id: 'COM_07', domainId: 'D2', textAr: 'هل تبنت المنشأة نظام إدارة بيئية ISO 14001 أو ما يعادله؟', textEn: 'Has the organization adopted ISO 14001 or an equivalent environmental management system?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'regulatory_reporting', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'COM_08', domainId: 'D2', textAr: 'هل المنشأة مستعدة للتفتيش التنظيمي في أي وقت؟', textEn: 'Is the organization prepared for regulatory inspections at any time?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'compliance_permits', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'COM_09', domainId: 'D2', textAr: 'هل توجد إجراءات موثقة للإبلاغ عن الحوادث البيئية؟', textEn: 'Are there documented procedures for reporting environmental incidents?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'regulatory_reporting', baseWeight: 1.0, calculatorType: null, applicability: all },

  // D3 — Emissions & Climate
  { id: 'EMI_01', domainId: 'D3', textAr: 'هل تحتفظ المنشأة بجرد موثق لانبعاثات الغازات الدفيئة للنطاقين 1 و2؟', textEn: 'Does the organization maintain a documented GHG inventory (Scope 1 & 2)?', helpTextAr: 'النطاق 1: انبعاثات مباشرة. النطاق 2: انبعاثات غير مباشرة من الطاقة المشتراة.', helpTextEn: 'Scope 1: direct emissions. Scope 2: indirect emissions from purchased energy.', materialityTopicId: 'ghg_emissions', baseWeight: 1.3, calculatorType: 'scope12', applicability: all },
  { id: 'EMI_02', domainId: 'D3', textAr: 'هل وضعت المنشأة أهدافًا لخفض انبعاثات الكربون؟', textEn: 'Has the organization set carbon emission reduction targets?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'ghg_emissions', baseWeight: 1.1, calculatorType: null, applicability: all },
  { id: 'EMI_03', domainId: 'D3', textAr: 'هل تراقب المنشأة جودة الهواء والانبعاثات وتبلغ عنها دوريًا؟', textEn: 'Does the organization monitor and periodically report air quality and emissions?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'air_quality', baseWeight: 1.1, calculatorType: null, applicability: all },
  { id: 'EMI_04', domainId: 'D3', textAr: 'هل أجرت المنشأة تقييمًا لمخاطر تغير المناخ على عملياتها؟', textEn: 'Has the organization assessed climate-change risks to its operations?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'ghg_emissions', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'EMI_05', domainId: 'D3', textAr: 'هل توجد ضوابط للحد من الانبعاثات التشغيلية والتسربات؟', textEn: 'Are there controls to limit process and fugitive emissions?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'air_quality', baseWeight: 1.0, calculatorType: null, applicability: { sectors: ['oil_and_gas', 'industrial', 'manufacturing', 'mining'] } },

  // D4 — Resource Efficiency
  { id: 'RES_01', domainId: 'D4', textAr: 'هل تتتبع المنشأة استهلاك الطاقة وتعمل على تقليله؟', textEn: 'Does the organization track and work to reduce energy consumption?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'energy_use', baseWeight: 1.1, calculatorType: 'resource_efficiency', applicability: all },
  { id: 'RES_02', domainId: 'D4', textAr: 'هل تتتبع المنشأة استهلاك المياه وتعمل على ترشيده؟', textEn: 'Does the organization track and work to reduce water consumption?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'water_management', baseWeight: 1.1, calculatorType: null, applicability: all },
  { id: 'RES_03', domainId: 'D4', textAr: 'هل تعتمد المنشأة مصادر طاقة متجددة أو خططًا لاعتمادها؟', textEn: 'Does the organization use, or plan to use, renewable energy sources?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'energy_use', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'RES_04', domainId: 'D4', textAr: 'هل تطبق المنشأة ممارسات لكفاءة استخدام المواد الخام؟', textEn: 'Does the organization apply material-efficiency practices?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'energy_use', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'RES_05', domainId: 'D4', textAr: 'هل توجد أنظمة لإعادة استخدام أو تدوير المياه؟', textEn: 'Are there systems to reuse or recycle water?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'water_management', baseWeight: 1.0, calculatorType: null, applicability: { sectors: ['industrial', 'manufacturing', 'oil_and_gas', 'mining'] } },

  // D5 — Waste & Circular Economy
  { id: 'WST_01', domainId: 'D5', textAr: 'هل تفصل المنشأة النفايات وتتتبع كمياتها؟', textEn: 'Does the organization segregate waste and track its quantities?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'waste_hazardous', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'WST_02', domainId: 'D5', textAr: 'هل يتم التخلص من النفايات الخطرة عبر جهات مرخّصة؟', textEn: 'Is hazardous waste disposed of through licensed contractors?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'waste_hazardous', baseWeight: 1.3, calculatorType: null, applicability: all },
  { id: 'WST_03', domainId: 'D5', textAr: 'هل لدى المنشأة مبادرات لإعادة التدوير أو الاقتصاد الدائري؟', textEn: 'Does the organization have recycling or circular-economy initiatives?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'circular_economy', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'WST_04', domainId: 'D5', textAr: 'هل وضعت المنشأة أهدافًا لخفض النفايات؟', textEn: 'Has the organization set waste-reduction targets?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'circular_economy', baseWeight: 0.9, calculatorType: null, applicability: all },

  // D6 — Disclosure & Stakeholders
  { id: 'DIS_01', domainId: 'D6', textAr: 'هل تنشر المنشأة تقريرًا دوريًا للاستدامة أو الأداء البيئي؟', textEn: 'Does the organization publish a periodic sustainability or environmental report?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'disclosure_reporting', baseWeight: 1.0, calculatorType: null, applicability: all },
  { id: 'DIS_02', domainId: 'D6', textAr: 'هل تشرك المنشأة المجتمع وأصحاب المصلحة في قضاياها البيئية؟', textEn: 'Does the organization engage the community and stakeholders on environmental matters?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'stakeholder_engagement', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'DIS_03', domainId: 'D6', textAr: 'هل توجد آلية لاستقبال الشكاوى البيئية ومعالجتها؟', textEn: 'Is there a mechanism to receive and address environmental grievances?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'stakeholder_engagement', baseWeight: 0.9, calculatorType: null, applicability: all },
  { id: 'DIS_04', domainId: 'D6', textAr: 'هل يتم التحقق من بيانات الأداء البيئي من جهة مستقلة؟', textEn: 'Is environmental performance data independently verified or assured?', helpTextAr: null, helpTextEn: null, materialityTopicId: 'disclosure_reporting', baseWeight: 0.8, calculatorType: null, applicability: all },
];

export const DRAFT_MATERIALITY_WEIGHTS: DraftMaterialityWeight[] = [
  { dimension: 'sector', dimensionValue: 'oil_and_gas', materialityTopicId: 'ghg_emissions', multiplier: 1.5 },
  { dimension: 'sector', dimensionValue: 'oil_and_gas', materialityTopicId: 'air_quality', multiplier: 1.4 },
  { dimension: 'sector', dimensionValue: 'oil_and_gas', materialityTopicId: 'waste_hazardous', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'oil_and_gas', materialityTopicId: 'water_management', multiplier: 1.2 },
  { dimension: 'sector', dimensionValue: 'manufacturing', materialityTopicId: 'energy_use', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'manufacturing', materialityTopicId: 'waste_hazardous', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'manufacturing', materialityTopicId: 'water_management', multiplier: 1.2 },
  { dimension: 'sector', dimensionValue: 'industrial', materialityTopicId: 'ghg_emissions', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'industrial', materialityTopicId: 'air_quality', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'industrial', materialityTopicId: 'waste_hazardous', multiplier: 1.3 },
  { dimension: 'sector', dimensionValue: 'construction', materialityTopicId: 'waste_hazardous', multiplier: 1.2 },
  { dimension: 'sector', dimensionValue: 'construction', materialityTopicId: 'water_management', multiplier: 1.2 },
  { dimension: 'exposure', dimensionValue: 'high', materialityTopicId: 'ghg_emissions', multiplier: 1.2 },
  { dimension: 'exposure', dimensionValue: 'high', materialityTopicId: 'compliance_permits', multiplier: 1.2 },
  { dimension: 'exposure', dimensionValue: 'high', materialityTopicId: 'waste_hazardous', multiplier: 1.1 },
];

export const DRAFT_SCORING_CONFIG: DraftScoringConfig = {
  id: 'default-v1',
  name: 'Default draft weighting v1',
  domainWeights: { D1: 0.15, D2: 0.25, D3: 0.2, D4: 0.15, D5: 0.15, D6: 0.1 },
};

export const DRAFT_RECOMMENDATIONS: DraftRecommendation[] = [
  {
    id: 'REC_POLICY', materialityTopicId: 'governance_policy', domainId: 'D1', triggerMaxScore: 50,
    immediateActionAr: 'اعتماد سياسة بيئية موثقة من الإدارة العليا.', immediateActionEn: 'Adopt a documented environmental policy approved by senior management.',
    shortTermActionAr: 'تعيين مسؤول بيئي وتحديد المسؤوليات.', shortTermActionEn: 'Appoint an environmental officer and define responsibilities.',
    mediumTermActionAr: 'دمج الأهداف البيئية في الخطة الاستراتيجية.', mediumTermActionEn: 'Integrate environmental objectives into the strategic plan.',
    costEstimate: 'SAR 20,000 – 60,000', effortLevel: 'low', scoreImpactPoints: 6, timelineWeeks: 8, legalReference: 'NCEC governance guidelines',
  },
  {
    id: 'REC_PERMITS', materialityTopicId: 'compliance_permits', domainId: 'D2', triggerMaxScore: 50,
    immediateActionAr: 'حصر التراخيص البيئية المطلوبة والمنتهية.', immediateActionEn: 'Inventory required and expired environmental permits.',
    shortTermActionAr: 'تقديم طلبات التجديد للمركز الوطني للرقابة البيئية.', shortTermActionEn: 'Submit renewal applications to NCEC.',
    mediumTermActionAr: 'إنشاء سجل امتثال وتنبيهات للتجديد.', mediumTermActionEn: 'Build a compliance register with renewal alerts.',
    costEstimate: 'SAR 30,000 – 120,000', effortLevel: 'medium', scoreImpactPoints: 10, timelineWeeks: 10, legalReference: 'NCEC permitting regulation',
  },
  {
    id: 'REC_GHG', materialityTopicId: 'ghg_emissions', domainId: 'D3', triggerMaxScore: 50,
    immediateActionAr: 'بدء جرد انبعاثات النطاق 1 و2.', immediateActionEn: 'Start a Scope 1 & 2 emissions inventory.',
    shortTermActionAr: 'وضع خط أساس وأهداف لخفض الانبعاثات.', shortTermActionEn: 'Establish a baseline and emission-reduction targets.',
    mediumTermActionAr: 'تنفيذ مشاريع كفاءة الطاقة والطاقة المتجددة.', mediumTermActionEn: 'Implement energy-efficiency and renewable-energy projects.',
    costEstimate: 'SAR 80,000 – 400,000', effortLevel: 'high', scoreImpactPoints: 8, timelineWeeks: 16, legalReference: 'NCEC GHG reporting framework',
  },
  {
    id: 'REC_WATER', materialityTopicId: 'water_management', domainId: 'D4', triggerMaxScore: 50,
    immediateActionAr: 'تركيب عدادات لقياس استهلاك المياه.', immediateActionEn: 'Install meters to measure water consumption.',
    shortTermActionAr: 'تحديد فرص ترشيد المياه وأهداف الخفض.', shortTermActionEn: 'Identify water-saving opportunities and reduction targets.',
    mediumTermActionAr: 'تركيب أنظمة إعادة استخدام المياه.', mediumTermActionEn: 'Install water-reuse systems.',
    costEstimate: 'SAR 40,000 – 200,000', effortLevel: 'medium', scoreImpactPoints: 6, timelineWeeks: 12, legalReference: 'MEWA water regulations',
  },
  {
    id: 'REC_WASTE', materialityTopicId: 'waste_hazardous', domainId: 'D5', triggerMaxScore: 50,
    immediateActionAr: 'فصل النفايات الخطرة وتأمين تخزينها.', immediateActionEn: 'Segregate hazardous waste and secure its storage.',
    shortTermActionAr: 'التعاقد مع جهة مرخّصة للتخلص من النفايات.', shortTermActionEn: 'Contract a licensed hazardous-waste disposal provider.',
    mediumTermActionAr: 'إطلاق برنامج لخفض النفايات وإعادة التدوير.', mediumTermActionEn: 'Launch a waste-reduction and recycling program.',
    costEstimate: 'SAR 25,000 – 150,000', effortLevel: 'medium', scoreImpactPoints: 7, timelineWeeks: 10, legalReference: 'NCEC waste management regulation',
  },
  {
    id: 'REC_DISCLOSURE', materialityTopicId: 'disclosure_reporting', domainId: 'D6', triggerMaxScore: 50,
    immediateActionAr: 'تجميع بيانات الأداء البيئي الأساسية.', immediateActionEn: 'Compile core environmental performance data.',
    shortTermActionAr: 'إصدار تقرير استدامة سنوي مبسّط.', shortTermActionEn: 'Publish a simplified annual sustainability report.',
    mediumTermActionAr: 'اعتماد إطار إفصاح معترف به دوليًا مع تحقق مستقل.', mediumTermActionEn: 'Adopt a recognized disclosure framework (GRI) with independent assurance.',
    costEstimate: 'SAR 30,000 – 100,000', effortLevel: 'low', scoreImpactPoints: 5, timelineWeeks: 12, legalReference: 'GRI Standards',
  },
];

// Placeholder terms — replace with the Academy's approved 50+ term glossary.
export const DRAFT_GLOSSARY: DraftGlossaryTerm[] = [
  { termAr: 'النضج البيئي', termEn: 'Environmental Maturity', definitionAr: 'مستوى تطور ممارسات المنشأة البيئية وقدرتها على إدارة أثرها البيئي.', definitionEn: 'The level of development of an organization’s environmental practices.', category: 'عام' },
  { termAr: 'الحوكمة البيئية', termEn: 'Environmental Governance', definitionAr: 'الأطر والسياسات والمسؤوليات التي توجه إدارة الشؤون البيئية في المنشأة.', definitionEn: 'The frameworks and policies guiding environmental management.', category: 'الحوكمة' },
  { termAr: 'الانبعاثات النطاق 1', termEn: 'Scope 1 Emissions', definitionAr: 'الانبعاثات المباشرة من المصادر المملوكة أو الخاضعة لسيطرة المنشأة.', definitionEn: 'Direct emissions from owned or controlled sources.', category: 'الانبعاثات' },
  { termAr: 'الانبعاثات النطاق 2', termEn: 'Scope 2 Emissions', definitionAr: 'الانبعاثات غير المباشرة الناتجة عن الطاقة المشتراة والمستهلكة.', definitionEn: 'Indirect emissions from purchased energy.', category: 'الانبعاثات' },
  { termAr: 'الأهمية النسبية', termEn: 'Materiality', definitionAr: 'مدى أهمية موضوع بيئي معيّن لقطاع المنشأة ومستوى تعرضها البيئي.', definitionEn: 'The relevance of an environmental topic to a sector and exposure level.', category: 'المنهجية' },
];

export const DRAFT_REGULATORY_MAPPINGS: DraftRegulatoryMapping[] = [
  { bankQuestionId: 'COM_01', regulation: 'Environmental Law', clause: 'Permits & licensing', authority: 'NCEC', url: null },
  { bankQuestionId: 'COM_02', regulation: 'Water & wastewater regulations', clause: 'Discharge limits', authority: 'MEWA', url: null },
  { bankQuestionId: 'EMI_03', regulation: 'Air quality standards', clause: 'Emissions monitoring', authority: 'NCEC', url: null },
  { bankQuestionId: 'WST_02', regulation: 'Hazardous waste regulation', clause: 'Licensed disposal', authority: 'NCEC', url: null },
];
