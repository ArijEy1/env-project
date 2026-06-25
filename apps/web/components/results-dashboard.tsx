'use client';

import { useEffect, useState } from 'react';
import { getAssessment, fetchRecommendations, fetchResults, downloadReport, type Assessment, type Recommendation, type ResultsData } from '../lib/assessment-client';
import { fetchProfile, authStorage, type AuthUser } from '../lib/auth-client';
import { ENTITY_TYPE_OPTIONS, EXPOSURE_OPTIONS, SECTOR_OPTIONS, optionLabel } from '../lib/profile-options';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';
import { useToast } from './toast-provider';
import { ScoreDonut } from './score-donut';
import { RadarChart, type RadarDatum } from './radar-chart';

interface ResultsDashboardProps {
  assessmentId: string;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#E24B4A',
  2: '#EF9F27',
  3: '#ADD378',
  4: '#5DCAA5',
  5: '#0FE656',
};

const MATURITY_LABELS: Record<number, { ar: string; en: string }> = {
  1: { ar: 'مبتدئ', en: 'Beginning' },
  2: { ar: 'أساسي', en: 'Basic' },
  3: { ar: 'متوسط', en: 'Intermediate' },
  4: { ar: 'متقدم', en: 'Advanced' },
  5: { ar: 'رائد', en: 'Leading' },
};

const EFFORT_LABELS: Record<string, { ar: string; en: string }> = {
  low: { ar: 'منخفض', en: 'Low' },
  medium: { ar: 'متوسط', en: 'Medium' },
  high: { ar: 'مرتفع', en: 'High' },
};

export function ResultsDashboard({ assessmentId }: ResultsDashboardProps) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [roadmapTab, setRoadmapTab] = useState<'immediate' | 'short' | 'medium'>('immediate');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem(authStorage.tokenKey);
        if (!token) {
          setError(isArabic ? 'يرجى تسجيل الدخول' : 'Please log in');
          setIsLoading(false);
          return;
        }

        const [assessmentData, profile] = await Promise.all([
          getAssessment(assessmentId),
          fetchProfile(token),
        ]);

        if (assessmentData.status === 'draft') {
          window.location.replace(`/assessment/${assessmentId}`);
          return;
        }

        setAssessment(assessmentData);
        setUser(profile);
        if (assessmentData.status === 'submitted') {
          const [recs, resultsData] = await Promise.all([
            fetchRecommendations(assessmentId),
            fetchResults(assessmentId),
          ]);
          setRecommendations(recs);
          setResults(resultsData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل تحميل النتائج' : 'Failed to load results';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [assessmentId, isArabic]);

  if (isLoading) {
    return (
      <div className="results-loading">
        <p>{isArabic ? 'جاري تحميل النتائج...' : 'Loading results...'}</p>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="results-error">
        <p className="auth-feedback auth-feedback-error">{error}</p>
      </div>
    );
  }

  const level = assessment.maturityLevel ?? 1;
  const levelColor = LEVEL_COLORS[level];
  const levelLabel = MATURITY_LABELS[level] ?? MATURITY_LABELS[1];
  const entityName = user ? (isArabic ? user.entity.nameAr : (user.entity.nameEn || user.entity.nameAr)) : '';
  const submittedDate = assessment.submittedAt
    ? new Date(assessment.submittedAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const domainResults = results?.domains ?? [];
  const radarData: RadarDatum[] = domainResults.map((d) => ({
    label: d.id,
    fullLabel: isArabic ? d.nameAr : d.nameEn,
    score: d.score,
  }));

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadReport(assessmentId);
      showToast(isArabic ? 'تم تحميل التقرير' : 'Report downloaded', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل تحميل التقرير' : 'Failed to download report';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="results-shell">
      {/* Header */}
      <div className="results-header">
        <h1>{isArabic ? 'نتائج التقييم' : 'Assessment Results'}</h1>
        <p className="results-meta">
          {entityName}{entityName && submittedDate ? ' · ' : ''}{submittedDate}
        </p>
      </div>

      {/* Main score card */}
      <div className="results-main-card">
        <div className="results-donut-section">
          <ScoreDonut score={assessment.totalScore ?? 0} maturityLevel={level} />
        </div>
        <div className="results-maturity-section">
          <span className="results-maturity-label">{isArabic ? 'مستوى النضج' : 'Maturity Level'}</span>
          <div className="results-maturity-level" style={{ color: levelColor }}>
            <span className="results-maturity-number" style={{ borderColor: levelColor, boxShadow: `0 0 20px ${levelColor}22` }}>
              {level}
            </span>
            <span className="results-maturity-name">{isArabic ? levelLabel.ar : levelLabel.en}</span>
          </div>
          <p className="results-total-label">
            {isArabic ? 'الدرجة الإجمالية' : 'Total Score'}: <strong>{(assessment.totalScore ?? 0).toFixed(2)}</strong> / 100
          </p>
        </div>
      </div>

      {/* Radar + profile summary */}
      {domainResults.length > 0 && (
        <div className="results-radar-row">
          <div className="results-radar-card">
            <h2 className="results-section-title">{isArabic ? 'الأداء حسب المجال' : 'Performance by domain'}</h2>
            <RadarChart data={radarData} />
          </div>
          {results?.profile && (
            <div className="results-profile-card">
              <h2 className="results-section-title">{isArabic ? 'ملف المنشأة' : 'Organization profile'}</h2>
              <div className="results-profile-list">
                <div className="results-profile-row"><span>{isArabic ? 'نوع المنشأة' : 'Entity type'}</span><strong>{optionLabel(ENTITY_TYPE_OPTIONS, results.profile.entityType, isArabic)}</strong></div>
                <div className="results-profile-row"><span>{isArabic ? 'القطاع' : 'Sector'}</span><strong>{optionLabel(SECTOR_OPTIONS, results.profile.sector, isArabic)}</strong></div>
                <div className="results-profile-row"><span>{isArabic ? 'الحجم' : 'Size'}</span><strong>{results.profile.employeeCountBracket || (isArabic ? 'غير محدد' : 'Not set')}</strong></div>
                <div className="results-profile-row"><span>{isArabic ? 'التعرض البيئي' : 'Exposure'}</span><strong>{optionLabel(EXPOSURE_OPTIONS, results.profile.environmentalExposure, isArabic)}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Six domain cards */}
      <div className="results-domains">
        {domainResults.map((d) => {
          const color = LEVEL_COLORS[d.maturity] ?? LEVEL_COLORS[1];
          const topGap = isArabic ? d.topGapAr : d.topGapEn;
          return (
            <div key={d.id} className="results-domain-card">
              <div className="results-domain-header">
                <span className="results-domain-name">{isArabic ? d.nameAr : d.nameEn}</span>
                <span className="results-domain-maturity" style={{ background: `${color}22`, color }}>
                  {isArabic ? 'مستوى' : 'L'} {d.maturity}
                </span>
              </div>
              <div className="results-domain-score">
                <strong>{d.score.toFixed(1)}</strong> / 100
              </div>
              <div className="results-domain-bar">
                <div className="results-domain-bar-fill" style={{ width: `${d.score}%`, background: color }} />
              </div>
              {topGap ? (
                <p className="results-domain-gap" title={topGap}>
                  {isArabic ? 'أبرز فجوة: ' : 'Top gap: '}{topGap}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Recommendations roadmap */}
      {recommendations.length > 0 && (
        <div className="results-recommendations">
          <h2 className="results-section-title">
            {isArabic ? 'خطة التحسين' : 'Improvement Roadmap'}
          </h2>

          <div className="roadmap-tabs">
            {([
              ['immediate', isArabic ? 'فوري' : 'Immediate'],
              ['short', isArabic ? 'قصير المدى' : 'Short-term'],
              ['medium', isArabic ? 'متوسط المدى' : 'Medium-term'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`roadmap-tab ${roadmapTab === key ? 'roadmap-tab-active' : ''}`}
                onClick={() => setRoadmapTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {recommendations.map((rec) => {
            const action =
              roadmapTab === 'immediate'
                ? (isArabic ? rec.immediateActionAr : rec.immediateActionEn)
                : roadmapTab === 'short'
                  ? (isArabic ? rec.shortTermActionAr : rec.shortTermActionEn)
                  : (isArabic ? rec.mediumTermActionAr : rec.mediumTermActionEn);
            const effortLabel = EFFORT_LABELS[rec.effortLevel] ?? { ar: rec.effortLevel, en: rec.effortLevel };
            return (
              <div key={rec.recommendationId} className="results-rec-card">
                <div className="results-rec-header">
                  <span className="results-rec-rank">{rec.rank}</span>
                  <div className="results-rec-question">
                    <p className="results-rec-question-text">
                      {isArabic ? rec.questionTextAr : rec.questionTextEn}
                      {rec.isCompliance ? (
                        <span className="rec-priority-badge">{isArabic ? 'أولوية امتثال' : 'Compliance priority'}</span>
                      ) : null}
                    </p>
                    <span className="results-rec-score">
                      {isArabic ? 'درجتك' : 'Your score'}: {rec.currentScore} / 100
                    </span>
                  </div>
                </div>
                <div className="results-rec-body">
                  <div className="results-rec-item">
                    <span className="results-rec-label">
                      {roadmapTab === 'immediate' ? (isArabic ? 'إجراء فوري' : 'Immediate action')
                        : roadmapTab === 'short' ? (isArabic ? 'إجراء قصير المدى' : 'Short-term action')
                          : (isArabic ? 'إجراء متوسط المدى' : 'Medium-term action')}
                    </span>
                    <p>{action}</p>
                  </div>
                  <div className="rec-meta">
                    <span className="rec-meta-chip">{isArabic ? 'الأثر' : 'Impact'}: +{rec.scoreImpactPoints} {isArabic ? 'نقطة' : 'pts'}</span>
                    <span className="rec-meta-chip">{isArabic ? 'الجهد' : 'Effort'}: {isArabic ? effortLabel.ar : effortLabel.en}</span>
                    <span className="rec-meta-chip">{isArabic ? 'المدة' : 'Timeline'}: {rec.timelineWeeks} {isArabic ? 'أسبوع' : 'wks'}</span>
                    {rec.costEstimate ? <span className="rec-meta-chip">{isArabic ? 'التكلفة' : 'Cost'}: {rec.costEstimate}</span> : null}
                    {rec.legalReference ? <span className="rec-meta-chip rec-meta-legal">{rec.legalReference}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="results-actions">
        <a href="/account" className="secondary-btn">{isArabic ? '← العودة للحساب' : '← Back to Account'}</a>
        <button className="primary-btn results-download-btn" onClick={handleDownloadPdf} disabled={downloading} type="button">
          {downloading ? (isArabic ? 'جاري التحميل...' : 'Downloading...') : (isArabic ? 'تحميل التقرير PDF' : 'Download PDF Report')}
        </button>
      </div>
    </div>
  );
}
