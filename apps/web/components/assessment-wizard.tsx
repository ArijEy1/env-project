'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAssessment,
  fetchQuestions,
  saveAnswer,
  updateProgress,
  submitAssessment,
  type Assessment,
  type QuestionsData,
} from '../lib/assessment-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';

interface AssessmentWizardProps {
  assessmentId: string;
}

export function AssessmentWizard({ assessmentId }: AssessmentWizardProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [qData, aData] = await Promise.all([
          fetchQuestions(),
          getAssessment(assessmentId),
        ]);
        setQuestionsData(qData);
        setAssessment(aData);
        setCurrentIndex(aData.currentQuestionIndex);
        const answerMap: Record<string, number> = {};
        for (const a of aData.answers) {
          answerMap[a.questionId] = a.score;
        }
        setAnswers(answerMap);
      } catch (err) {
        setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل تحميل التقييم' : 'Failed to load assessment');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [assessmentId]);

  const debouncedProgressSave = useCallback(
    (index: number) => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      progressSaveTimer.current = setTimeout(() => {
        void updateProgress(assessmentId, index).catch(() => {});
      }, 500);
    },
    [assessmentId],
  );

  if (isLoading) {
    return (
      <div className="wizard-loading">
        <p>{isArabic ? 'جاري تحميل التقييم...' : 'Loading assessment...'}</p>
      </div>
    );
  }

  if (error || !questionsData || !assessment) {
    return (
      <div className="wizard-error">
        <p className="auth-feedback auth-feedback-error">{error || (isArabic ? 'خطأ في التحميل' : 'Loading error')}</p>
      </div>
    );
  }

  if (assessment.status === 'submitted') {
    return (
      <div className="wizard-submitted">
        <h2>{isArabic ? 'تم إرسال التقييم' : 'Assessment submitted'}</h2>
        <p>{isArabic ? 'تم إرسال هذا التقييم بالفعل.' : 'This assessment has already been submitted.'}</p>
      </div>
    );
  }

  const { questions, domains, answerOptions, totalQuestions } = questionsData;
  const question = questions[currentIndex];
  const domain = domains.find((d) => d.id === question.domain)!;
  const selectedScore = answers[question.id];
  const governanceCount = questions.filter((q) => q.domain === 'governance').length;
  const isLastGovernance = currentIndex === governanceCount - 1;
  const isLast = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;

  async function handleSelectAnswer(score: number) {
    setSaving(true);
    setError('');
    try {
      await saveAnswer(assessmentId, question.id, score);
      setAnswers((prev) => ({ ...prev, [question.id]: score }));
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل حفظ الإجابة' : 'Failed to save answer');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (isLastGovernance && !showTransition) {
      setShowTransition(true);
      return;
    }
    if (isLast) {
      setShowConfirm(true);
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setShowTransition(false);
    debouncedProgressSave(next);
  }

  function handleBack() {
    if (showTransition) {
      setShowTransition(false);
      return;
    }
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      debouncedProgressSave(prev);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await submitAssessment(assessmentId);
      window.location.replace(`/assessment/${assessmentId}/results`);
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل إرسال التقييم' : 'Failed to submit');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Domain transition screen
  if (showTransition) {
    const nextDomain = domains.find((d) => d.id === 'compliance')!;
    return (
      <div className="wizard-shell">
        <div className="wizard-progress">
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${((governanceCount) / totalQuestions) * 100}%` }} />
          </div>
          <span className="wizard-progress-text">{governanceCount} / {totalQuestions}</span>
        </div>
        <div className="wizard-transition-card">
          <div className="wizard-transition-check">&#10003;</div>
          <h2>{isArabic ? `تم الانتهاء من ${domain.nameAr}` : `${domain.nameEn} complete`}</h2>
          <p>{isArabic ? `الآن ننتقل إلى المجال الثاني: ${nextDomain.nameAr}` : `Now starting Domain 2: ${nextDomain.nameEn}`}</p>
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={handleBack} type="button">{isArabic ? '→ رجوع' : '← Back'}</button>
            <button className="primary-btn" onClick={() => { setShowTransition(false); setCurrentIndex(governanceCount); debouncedProgressSave(governanceCount); }} type="button">{isArabic ? 'متابعة ←' : 'Continue →'}</button>
          </div>
        </div>
      </div>
    );
  }

  // Confirm dialog
  if (showConfirm) {
    return (
      <div className="wizard-shell">
        <div className="wizard-transition-card">
          <h2>{isArabic ? 'تأكيد الإرسال' : 'Confirm submission'}</h2>
          <p>{isArabic ? `لقد أجبت على ${answeredCount} من ${totalQuestions} سؤال. هل تريد إرسال التقييم؟` : `You have answered ${answeredCount} of ${totalQuestions} questions. Submit the assessment?`}</p>
          {answeredCount < totalQuestions && (
            <p className="wizard-confirm-warning">{isArabic ? 'تنبيه: لم تجب على جميع الأسئلة بعد.' : 'Warning: Not all questions have been answered yet.'}</p>
          )}
          {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={() => setShowConfirm(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
            <button className="primary-btn" onClick={handleSubmit} disabled={submitting} type="button">{submitting ? (isArabic ? 'جاري الإرسال...' : 'Submitting...') : (isArabic ? 'إرسال التقييم' : 'Submit assessment')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-shell">
      <div className="wizard-progress">
        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} />
        </div>
        <span className="wizard-progress-text">{currentIndex + 1} / {totalQuestions}</span>
      </div>
      <div className="wizard-domain-badge">{isArabic ? domain.nameAr : domain.nameEn}</div>
      <div className="wizard-question-card">
        <span className="wizard-question-number">{isArabic ? `س${currentIndex + 1}` : `Q${currentIndex + 1}`}</span>
        <h2 className="wizard-question-text">{isArabic ? question.textAr : question.textEn}</h2>
      </div>
      <div className="wizard-options">
        {answerOptions.map((option) => (
          <button
            key={option.score}
            className={`wizard-option ${selectedScore === option.score ? 'wizard-option-selected' : ''}`}
            onClick={() => handleSelectAnswer(option.score)}
            disabled={saving}
            type="button"
          >
            <span className="wizard-option-radio">{selectedScore === option.score ? '●' : '○'}</span>
            <span className="wizard-option-label">{isArabic ? option.labelAr : option.labelEn}</span>
            <span className="wizard-option-score">{option.score}</span>
          </button>
        ))}
      </div>
      {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
      <div className="wizard-nav">
        <button className="secondary-btn" onClick={handleBack} disabled={currentIndex === 0} type="button">{isArabic ? '→ السابق' : '← Previous'}</button>
        <button className="primary-btn" onClick={handleNext} disabled={selectedScore === undefined} type="button">{isLast ? (isArabic ? 'إرسال التقييم' : 'Submit assessment') : (isArabic ? 'التالي ←' : 'Next →')}</button>
      </div>
    </div>
  );
}
