'use client';

import { useEffect, useState } from 'react';
import { getAssessment, fetchRecommendations, downloadReport, type Assessment, type Recommendation } from '../lib/assessment-client';
import { fetchProfile, authStorage, type AuthUser } from '../lib/auth-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';
import { ScoreDonut } from './score-donut';

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

const DOMAIN_INFO: Record<string, { ar: string; en: string; weight: number }> = {
  governance: { ar: 'الحوكمة البيئية', en: 'Environmental Governance', weight: 45 },
  compliance: { ar: 'الامتثال التنظيمي', en: 'Regulatory Compliance', weight: 55 },
};

export function ResultsDashboard({ assessmentId }: ResultsDashboardProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
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
          const recs = await fetchRecommendations(assessmentId);
          setRecommendations(recs);
        }
      } catch (err) {
        setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل تحميل النتائج' : 'Failed to load results');
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

  const domains = [
    { key: 'governance', score: assessment.governanceScore ?? 0 },
    { key: 'compliance', score: assessment.complianceScore ?? 0 },
  ];

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadReport(assessmentId);
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل تحميل التقرير' : 'Failed to download report');
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

      {/* Domain cards */}
      <div className="results-domains">
        {domains.map((d) => {
          const info = DOMAIN_INFO[d.key];
          return (
            <div key={d.key} className="results-domain-card">
              <div className="results-domain-header">
                <span className="results-domain-name">{isArabic ? info.ar : info.en}</span>
                <span className="results-domain-weight">{isArabic ? `الوزن: ${info.weight}%` : `Weight: ${info.weight}%`}</span>
              </div>
              <div className="results-domain-score">
                <strong>{d.score.toFixed(2)}</strong> / 100
              </div>
              <div className="results-domain-bar">
                <div className="results-domain-bar-fill" style={{ width: `${d.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="results-recommendations">
          <h2 className="results-section-title">
            {isArabic ? 'التوصيات' : 'Recommendations'}
          </h2>
          {recommendations.map((rec) => (
            <div key={rec.questionId} className="results-rec-card">
              <div className="results-rec-header">
                <span className="results-rec-rank">{rec.rank}</span>
                <div className="results-rec-question">
                  <p className="results-rec-question-text">
                    {isArabic ? rec.questionTextAr : rec.questionTextEn}
                  </p>
                  <span className="results-rec-score">
                    {isArabic ? 'درجتك' : 'Your score'}: {rec.score} / 100
                  </span>
                </div>
              </div>
              <div className="results-rec-body">
                <div className="results-rec-item">
                  <span className="results-rec-label">{isArabic ? 'الإجراء المطلوب' : 'Recommended Action'}</span>
                  <p>{isArabic ? rec.actionAr : rec.actionEn}</p>
                </div>
                <div className="results-rec-item">
                  <span className="results-rec-label">{isArabic ? 'الأثر المتوقع' : 'Expected Impact'}</span>
                  <p>{isArabic ? rec.impactAr : rec.impactEn}</p>
                </div>
                <div className="results-rec-item">
                  <span className="results-rec-label">{isArabic ? 'المرجع' : 'Reference'}</span>
                  <p>{isArabic ? rec.referenceAr : rec.referenceEn}</p>
                </div>
              </div>
            </div>
          ))}
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
