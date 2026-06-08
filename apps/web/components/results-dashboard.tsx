'use client';

import { useEffect, useState } from 'react';
import { getAssessment, type Assessment } from '../lib/assessment-client';
import { fetchProfile, authStorage, type AuthUser } from '../lib/auth-client';
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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : isArabic ? 'فشل تحميل النتائج' : 'Failed to load results');
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

      {/* Actions */}
      <div className="results-actions">
        <a href="/account" className="secondary-btn">{isArabic ? '← العودة للحساب' : '← Back to Account'}</a>
      </div>
    </div>
  );
}
