 'use client';

import Link from 'next/link';
import { useLanguage } from './language-provider';

const standards = ['رؤية 2030', 'ISO 14001', 'GRI', 'TCFD', 'ISSB'];

const benefits = [
  {
    title: 'Focus on priorities',
    titleAr: 'تركيز على الأولويات',
    description:
      'Turn regulatory, operational and sustainability signals into a clear action plan.',
    descriptionAr: 'حوّل المؤشرات التنظيمية والتشغيلية والاستدامية إلى خطة عمل واضحة وقابلة للتنفيذ.',
  },
  {
    title: 'Improve performance and compliance',
    titleAr: 'تحسين الأداء والامتثال',
    description:
      'Raise maturity across governance, operations and evidence-backed reporting.',
    descriptionAr: 'ارفع مستوى النضج في الحوكمة والعمليات والتقارير المدعومة بالأدلة.',
  },
  {
    title: 'Support sustainable transformation',
    titleAr: 'دعم الاستدامة',
    description:
      'Help institutions move toward more resilient and efficient environmental practices.',
    descriptionAr: 'ساعد الجهات على الانتقال إلى ممارسات بيئية أكثر كفاءة ومرونة واستدامة.',
  },
];

const steps = [
  {
    number: '1',
    title: 'Create your account',
    titleAr: 'إنشاء الحساب',
    description: 'Start with a simple registration flow and set up your organization profile.',
    descriptionAr: 'أنشئ حسابك وأكمل بيانات الجهة للبدء في رحلة التقييم.',
  },
  {
    number: '2',
    title: 'Complete the assessment',
    titleAr: 'إجراء التقييم',
    description: 'Answer guided questions across governance, operations and environmental controls.',
    descriptionAr: 'أجب عن الأسئلة الموجهة عبر الحوكمة والعمليات والضوابط البيئية.',
  },
  {
    number: '3',
    title: 'Review the results',
    titleAr: 'تحليل النتائج',
    description: 'Get an instant score, maturity level and a clear view of your strongest domains.',
    descriptionAr: 'احصل على درجة فورية ومستوى نضج وصورة واضحة لأبرز نقاط القوة.',
  },
  {
    number: '4',
    title: 'Act on recommendations',
    titleAr: 'اتخاذ الإجراءات',
    description: 'Follow practical recommendations and track progress toward a stronger posture.',
    descriptionAr: 'نفّذ التوصيات العملية وتابع التقدم نحو امتثال أقوى وأكثر استدامة.',
  },
];

const domains = [
  'الحوكمة والالتزام',
  'الامتثال والتراخيص',
  'إدارة المخاطر',
  'العمليات والضوابط',
  'البيانات والتحليل',
  'التواصل والشفافية',
];

const maturityLevels = [
  {
    title: 'Beginner',
    titleAr: 'مبدئي',
    description: 'Initial environmental efforts with foundational practices still being established.',
    descriptionAr: 'الجهة في بداية الطريق مع وجود جهود أولية وممارسات أساسية محدودة.',
  },
  {
    title: 'Emerging',
    titleAr: 'ناشئ',
    description: 'Basic controls are in place and teams start aligning around measurable outcomes.',
    descriptionAr: 'بدأت بعض الضوابط والممارسات الأساسية بالظهور مع توجه نحو نتائج قابلة للقياس.',
  },
  {
    title: 'Intermediate',
    titleAr: 'متوسط',
    description: 'Regular monitoring exists with structured follow-up and improvement planning.',
    descriptionAr: 'يوجد رصد دوري ومتابعة منظمة وخطط واضحة للتحسين المستمر.',
    highlighted: true,
  },
  {
    title: 'Advanced',
    titleAr: 'متقدم',
    description: 'Cross-functional practices are mature and supported by continuous optimization.',
    descriptionAr: 'الممارسات متقدمة عبر الفرق المختلفة ومدعومة بتحسينات مستمرة.',
  },
  {
    title: 'Leading',
    titleAr: 'رائد',
    description: 'Benchmark-level governance and innovation create a resilient environmental program.',
    descriptionAr: 'حوكمة وابتكار على مستوى رائد يحققان برنامجًا بيئيًا مرنًا ومتقدمًا.',
  },
];

const recommendations = [
  {
    title: 'Targeted recommendations',
    titleAr: 'توصيات مخصصة',
    description: 'Receive practical next steps tailored to your current score and weakest domains.',
    descriptionAr: 'احصل على خطوات عملية مقترحة وفق درجتك الحالية ومجالات التحسين الأهم.',
  },
  {
    title: 'Action plan',
    titleAr: 'خطة عمل واضحة',
    description: 'Turn findings into a phased roadmap with accountable owners and outcomes.',
    descriptionAr: 'حوّل النتائج إلى خارطة طريق مرحلية بمسؤوليات واضحة ومخرجات قابلة للقياس.',
  },
  {
    title: 'Progress monitoring',
    titleAr: 'متابعة التقدم',
    description: 'Track improvement over time and prepare for follow-up assessments with confidence.',
    descriptionAr: 'تابع التحسن بمرور الوقت واستعد للتقييمات اللاحقة بثقة أكبر.',
  },
];

const trustPoints = [
  {
    title: 'Nationally aligned',
    titleAr: 'متوافقة وطنيًا',
    description: 'Designed for regulatory alignment and operational fit within national frameworks.',
    descriptionAr: 'مصممة لتتوافق مع الأطر الوطنية والتنظيمية ومتطلبات التشغيل المحلية.',
  },
  {
    title: 'Hosted locally',
    titleAr: 'استضافة محلية',
    description: 'Ready for secure in-country deployment and controlled data residency options.',
    descriptionAr: 'جاهزة للنشر الآمن داخل الدولة مع خيارات واضحة لإقامة البيانات.',
  },
  {
    title: 'High privacy posture',
    titleAr: 'خصوصية عالية',
    description: 'Built with clear access control, secure handling and privacy-minded architecture.',
    descriptionAr: 'مبنية على ضوابط وصول واضحة ومعالجة آمنة للبيانات وهندسة تراعي الخصوصية.',
  },
];

const scoreBreakdown = [
  { label: 'الحوكمة', title: 'Governance', score: '3.6 / 5' },
  { label: 'العمليات', title: 'Operations', score: '2.9 / 5' },
  { label: 'التحليل', title: 'Analytics', score: '3.1 / 5' },
  { label: 'الشفافية', title: 'Transparency', score: '3.4 / 5' },
];

export function Homepage() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <main className="home-page">
      <section className="home-hero" id="top">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <span className="eyebrow">{isArabic ? 'منصة وطنية موثوقة' : 'Trusted national platform'}</span>
            <h1>{isArabic ? 'قيّم اليوم لتحافظ على الغد.' : 'Assess today to protect tomorrow.'}</h1>
            <p>
              {isArabic
                ? 'منصة وطنية حديثة لقياس الامتثال البيئي ومستوى النضج، تساعد الجهات على اتخاذ قرارات أوضح، ومتابعة المؤشرات، والحصول على توصيات عملية قابلة للتنفيذ.'
                : 'A modern national platform for environmental compliance and maturity assessment, helping institutions make clearer decisions, track indicators and receive actionable recommendations.'}
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" href="/register">
                {isArabic ? 'ابدأ التقييم الآن' : 'Start assessment now'}
              </Link>
              <Link className="secondary-btn" href="/login">
                {isArabic ? 'تسجيل الدخول' : 'Log in'}
              </Link>
            </div>
            <div className="hero-stat-row">
              <div className="hero-stat-card">
                <strong>3.2 / 5</strong>
                <span>{isArabic ? 'متوسط التقييم العام' : 'Average assessment score'}</span>
              </div>
              <div className="hero-stat-card">
                <strong>6</strong>
                <span>{isArabic ? 'مجالات التقييم' : 'Assessment domains'}</span>
              </div>
              <div className="hero-stat-card">
                <strong>5</strong>
                <span>{isArabic ? 'مستويات النضج' : 'Maturity levels'}</span>
              </div>
            </div>
          </div>

          <div className="home-hero-panel">
            <div className="dashboard-card">
              <div className="dashboard-topline">
                <div>
                  <span className="section-label">{isArabic ? 'مثال على نتيجة التقييم' : 'Sample assessment result'}</span>
                  <h2>{isArabic ? 'لوحة مؤشرات نضج الامتثال البيئي' : 'Environmental compliance maturity dashboard'}</h2>
                </div>
                <div className="dashboard-score">
                  <strong>3.2</strong>
                  <span>/ 5</span>
                </div>
              </div>

              <div className="dashboard-visuals">
                <div className="dashboard-radar">
                  <div className="radar-core">{isArabic ? 'ملف متوازن' : 'Balanced profile'}</div>
                </div>
                <div className="dashboard-bars">
                  {scoreBreakdown.map((item) => (
                    <div key={item.label} className="dashboard-bar-item">
                      <div className="dashboard-bar-copy">
                        <span>{isArabic ? item.label : item.title}</span>
                        <strong>{item.score}</strong>
                      </div>
                      <div className="dashboard-bar-track">
                        <div className="dashboard-bar-fill" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="standards-strip">
        <div className="home-section-inner standards-strip-inner">
          <p>{isArabic ? 'متوافقة مع أفضل المعايير والأطر الوطنية والعالمية' : 'Aligned with leading national and global standards and reporting frameworks'}</p>
          <div className="standards-grid">
            {standards.map((item) => (
              <span key={item}>{isArabic ? item : item === 'رؤية 2030' ? 'Vision 2030' : item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section" id="why-platform">
        <div className="home-section-inner">
          <div className="section-heading centered-heading">
            <span className="section-label">{isArabic ? 'لماذا هذه الأداة؟' : 'Why this platform?'}</span>
            <h2>{isArabic ? 'لماذا تختار الجهات هذه المنصة؟' : 'Why organizations choose this platform'}</h2>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="surface-card benefit-card">
                <div className="benefit-icon" />
                <h3>{isArabic ? benefit.titleAr : benefit.title}</h3>
                <p>{isArabic ? benefit.descriptionAr : benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section" id="how-it-works">
        <div className="home-section-inner">
          <div className="section-heading centered-heading">
            <span className="section-label">{isArabic ? 'كيف تعمل الأداة' : 'How it works'}</span>
            <h2>{isArabic ? 'مسار واضح من التقييم إلى التنفيذ' : 'A clear journey from assessment to action'}</h2>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <article key={step.number} className="step-card">
                <div className="step-marker">{step.number}</div>
                <h3>{isArabic ? step.titleAr : step.title}</h3>
                <p>{isArabic ? step.descriptionAr : step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section" id="domains">
        <div className="home-section-inner">
          <div className="section-heading centered-heading">
            <span className="section-label">{isArabic ? 'مجالات التقييم' : 'Assessment domains'}</span>
            <h2>{isArabic ? 'ستة مجالات تصنع امتثالًا بيئيًا أكثر نضجًا' : 'Six domains that shape stronger environmental compliance'}</h2>
          </div>
          <div className="domains-grid">
            {domains.map((domain, index) => (
              <article key={domain} className="surface-card domain-card">
                <span className="domain-index">0{index + 1}</span>
                <h3>
                  {isArabic
                    ? domain
                    : [
                        'Governance and commitment',
                        'Compliance and licensing',
                        'Risk management',
                        'Operations and controls',
                        'Data and analytics',
                        'Communication and transparency',
                      ][index]}
                </h3>
                <p>
                  {isArabic
                    ? 'أسئلة منظمة ومنهجية تقييم واضحة ومتابعة عملية مدعومة بالأدلة لهذا المجال.'
                    : 'Structured questions, clear scoring logic and evidence-based follow-up for this domain.'}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section" id="maturity">
        <div className="home-section-inner">
          <div className="section-heading centered-heading">
            <span className="section-label">{isArabic ? 'مستويات النضج' : 'Maturity levels'}</span>
            <h2>{isArabic ? 'خمسة مستويات لقياس نضج الامتثال البيئي' : 'Five levels of environmental compliance maturity'}</h2>
          </div>
          <div className="maturity-scale">
            {maturityLevels.map((level, index) => (
              <article key={level.title} className={`maturity-card${level.highlighted ? ' is-highlighted' : ''}`}>
                <div className="maturity-level-badge">{index + 1}</div>
                <h3>{isArabic ? level.titleAr : level.title}</h3>
                <p>{isArabic ? level.descriptionAr : level.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section reports-layout" id="reports">
        <div className="home-section-inner reports-layout-inner">
          <div className="surface-card reports-preview">
            <span className="section-label">{isArabic ? 'تقارير وتوصيات عملية' : 'Reports and recommendations'}</span>
            <h2>{isArabic ? 'حوّل النتائج إلى قرارات وتحسينات قابلة للتنفيذ' : 'Turn results into practical decisions and improvements'}</h2>
            <div className="report-mini-card">
              <div className="report-score">
                <strong>3.2</strong>
                <span>/ 5</span>
              </div>
              <div className="report-chart-grid">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="reports-list">
            {recommendations.map((item) => (
              <article key={item.title} className="surface-card recommendation-card">
                <div className="recommendation-icon" />
                <div>
                  <h3>{isArabic ? item.titleAr : item.title}</h3>
                  <p>{isArabic ? item.descriptionAr : item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="home-section-inner trust-strip-inner">
          {trustPoints.map((point) => (
            <article key={point.title} className="trust-card">
              <h3>{isArabic ? point.titleAr : point.title}</h3>
              <p>{isArabic ? point.descriptionAr : point.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="home-section-inner final-cta-inner surface-card">
          <div>
            <span className="section-label">{isArabic ? 'ابدأ الآن' : 'Start now'}</span>
            <h2>{isArabic ? 'ابدأ رحلتك نحو امتثال بيئي أكثر نضجًا واستدامة.' : 'Start your journey toward stronger and more sustainable environmental compliance.'}</h2>
            <p>
              {isArabic
                ? 'أنشئ حسابك، ونفّذ التقييم الأول، واحصل على توصيات واضحة وخطة عمل قابلة للتطبيق.'
                : 'Create your account, run the first assessment and get clear recommendations with an actionable roadmap.'}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="primary-btn" href="/register">
              {isArabic ? 'إنشاء مستخدم' : 'Create user'}
            </Link>
            <Link className="secondary-btn" href="/login">
              {isArabic ? 'الدخول إلى الحساب' : 'Access account'}
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section-inner home-footer-inner">
          <div className="home-footer-grid">
            <div>
              <h3>{isArabic ? 'الأداة الوطنية' : 'National Tool'}</h3>
              <p>{isArabic ? 'منصة وطنية لقياس نضج الامتثال البيئي وتحويل النتائج إلى توصيات قابلة للتنفيذ.' : 'A national platform to measure environmental compliance maturity and turn results into actionable recommendations.'}</p>
            </div>
            <div>
              <h4>{isArabic ? 'المنصة' : 'Platform'}</h4>
              <ul>
                <li>{isArabic ? 'عن الأداة' : 'About'}</li>
                <li>{isArabic ? 'كيف تعمل' : 'How it works'}</li>
                <li>{isArabic ? 'الموارد' : 'Resources'}</li>
              </ul>
            </div>
            <div>
              <h4>{isArabic ? 'الدعم' : 'Support'}</h4>
              <ul>
                <li>{isArabic ? 'الأسئلة الشائعة' : 'FAQ'}</li>
                <li>{isArabic ? 'تواصل معنا' : 'Contact us'}</li>
                <li>{isArabic ? 'الدعم الفني' : 'Technical support'}</li>
              </ul>
            </div>
            <div>
              <h4>{isArabic ? 'الحساب' : 'Account'}</h4>
              <ul>
                <li>{isArabic ? 'إنشاء حساب' : 'Create account'}</li>
                <li>{isArabic ? 'تسجيل الدخول' : 'Login'}</li>
                <li>{isArabic ? 'لوحة المستخدم' : 'User dashboard'}</li>
              </ul>
            </div>
          </div>
          <div className="home-footer-bottom">{isArabic ? 'جميع الحقوق محفوظة © 2026' : 'All rights reserved © 2026'}</div>
        </div>
      </footer>
    </main>
  );
}
