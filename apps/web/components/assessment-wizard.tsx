'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAssessment,
  fetchGeneratedQuestions,
  saveAnswer,
  saveCalculatorAnswer,
  updateProgress,
  submitAssessment,
  type Assessment,
  type GeneratedQuestionsData,
} from '../lib/assessment-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';
import { useToast } from './toast-provider';
import { AssessmentCalculator } from './assessment-calculator';

interface AssessmentWizardProps {
  assessmentId: string;
}

export function AssessmentWizard({ assessmentId }: AssessmentWizardProps) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';

  const [questionsData, setQuestionsData] = useState<GeneratedQuestionsData | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [calcInputs, setCalcInputs] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getPendingAnswers(): Record<string, number> {
    try {
      const raw = localStorage.getItem(`env-pending-${assessmentId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function setPendingAnswer(questionId: string, score: number) {
    const pending = getPendingAnswers();
    pending[questionId] = score;
    localStorage.setItem(`env-pending-${assessmentId}`, JSON.stringify(pending));
  }

  function removePendingAnswer(questionId: string) {
    const pending = getPendingAnswers();
    delete pending[questionId];
    if (Object.keys(pending).length === 0) {
      localStorage.removeItem(`env-pending-${assessmentId}`);
    } else {
      localStorage.setItem(`env-pending-${assessmentId}`, JSON.stringify(pending));
    }
  }

  async function syncPendingAnswers() {
    const pending = getPendingAnswers();
    for (const [qId, score] of Object.entries(pending)) {
      try {
        await saveAnswer(assessmentId, qId, score);
        removePendingAnswer(qId);
      } catch {
        // Still offline, leave pending
      }
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [qData, aData] = await Promise.all([
          fetchGeneratedQuestions(assessmentId),
          getAssessment(assessmentId),
        ]);
        setQuestionsData(qData);
        setAssessment(aData);
        setCurrentIndex(Math.min(aData.currentQuestionIndex, Math.max(0, qData.questions.length - 1)));
        const answerMap: Record<string, number> = {};
        const calcMap: Record<string, Record<string, unknown>> = {};
        for (const a of aData.answers) {
          answerMap[a.questionId] = a.score;
          if (a.calculatorInputs) calcMap[a.questionId] = a.calculatorInputs;
        }
        setAnswers(answerMap);
        setCalcInputs(calcMap);
        const pending = getPendingAnswers();
        if (Object.keys(pending).length > 0) {
          setAnswers((prev) => ({ ...prev, ...pending }));
          void syncPendingAnswers();
        }
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

  if (questions.length === 0) {
    return (
      <div className="wizard-error">
        <p className="auth-feedback auth-feedback-error">{isArabic ? 'لا توجد أسئلة لهذا التقييم.' : 'No questions for this assessment.'}</p>
      </div>
    );
  }

  const question = questions[currentIndex];
  const domain = domains.find((d) => d.id === question.domainId) ?? { id: question.domainId, nameAr: question.domainId, nameEn: question.domainId };
  const selectedScore = answers[question.questionId];
  const nextQuestion = questions[currentIndex + 1];
  const crossesDomain = !!nextQuestion && nextQuestion.domainId !== question.domainId;
  const isLast = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;
  const helpText = isArabic ? question.helpTextAr : question.helpTextEn;
  const domainIndex = domains.findIndex((d) => d.id === question.domainId);
  const domainProgress = domains.map((d) => {
    const qs = questions.filter((q) => q.domainId === d.id);
    const answered = qs.filter((q) => answers[q.questionId] !== undefined).length;
    return { id: d.id, name: isArabic ? d.nameAr : d.nameEn, answered, total: qs.length };
  });

  async function handleSelectAnswer(score: number) {
    setSaving(true);
    setSaveStatus('saving');
    setError('');
    setAnswers((prev) => ({ ...prev, [question.questionId]: score }));

    try {
      await saveAnswer(assessmentId, question.questionId, score);
      removePendingAnswer(question.questionId);
      setSaveStatus('saved');
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setPendingAnswer(question.questionId, score);
      setSaveStatus('failed');
      showToast(isArabic ? 'فشل الحفظ — محفوظ محلياً' : 'Save failed — saved locally', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculatorSave(inputs: Record<string, unknown>) {
    setSaving(true);
    setSaveStatus('saving');
    setError('');
    try {
      const res = await saveCalculatorAnswer(assessmentId, question.questionId, inputs);
      setAnswers((prev) => ({ ...prev, [question.questionId]: res.score }));
      setCalcInputs((prev) => ({ ...prev, [question.questionId]: inputs }));
      setSaveStatus('saved');
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('failed');
      showToast(isArabic ? 'فشل الحفظ' : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function goToIndex(index: number) {
    setCurrentIndex(index);
    setShowTransition(false);
    setShowHelp(false);
    debouncedProgressSave(index);
  }

  function handleNext() {
    if (crossesDomain && !showTransition) {
      setShowTransition(true);
      return;
    }
    if (isLast) {
      setShowConfirm(true);
      return;
    }
    goToIndex(currentIndex + 1);
  }

  function handleBack() {
    if (showTransition) {
      setShowTransition(false);
      return;
    }
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await submitAssessment(assessmentId);
      showToast(isArabic ? 'تم إرسال التقييم بنجاح' : 'Assessment submitted successfully', 'success');
      window.location.replace(`/assessment/${assessmentId}/results`);
    } catch (err) {
      const errorMessage = err instanceof Error ? translateError(err.message, isArabic) : isArabic ? 'فشل إرسال التقييم' : 'Failed to submit';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Domain transition screen (generic, fires whenever the domain changes)
  if (showTransition && nextQuestion) {
    const nextDomain = domains.find((d) => d.id === nextQuestion.domainId)!;
    return (
      <div className="wizard-shell">
        <div className="wizard-progress">
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} />
          </div>
          <span className="wizard-progress-text">{currentIndex + 1} / {totalQuestions}</span>
        </div>
        <div className="wizard-transition-card">
          <div className="wizard-transition-check">&#10003;</div>
          <h2>{isArabic ? `تم الانتهاء من ${domain.nameAr}` : `${domain.nameEn} complete`}</h2>
          <p>{isArabic ? `الآن ننتقل إلى: ${nextDomain.nameAr}` : `Now starting: ${nextDomain.nameEn}`}</p>
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={handleBack} type="button">{isArabic ? '→ رجوع' : '← Back'}</button>
            <button className="primary-btn" onClick={() => goToIndex(currentIndex + 1)} type="button">{isArabic ? 'متابعة ←' : 'Continue →'}</button>
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
      <div className="wizard-domain-progress">
        {domainProgress.map((dp) => (
          <div
            key={dp.id}
            className={`wizard-dp-chip${dp.total > 0 && dp.answered === dp.total ? ' wizard-dp-done' : ''}${dp.id === question.domainId ? ' wizard-dp-current' : ''}`}
            title={`${dp.name}: ${dp.answered}/${dp.total}`}
          >
            <span className="wizard-dp-name">{dp.name}</span>
            <span className="wizard-dp-count">{dp.answered}/{dp.total}</span>
          </div>
        ))}
      </div>
      {saveStatus !== 'idle' && (
        <div className={`wizard-save-indicator wizard-save-${saveStatus}`}>
          {saveStatus === 'saving' && (isArabic ? 'جاري الحفظ...' : 'Saving...')}
          {saveStatus === 'saved' && (isArabic ? 'تم الحفظ' : 'Saved')}
          {saveStatus === 'failed' && (isArabic ? 'فشل الحفظ — محفوظ محلياً' : 'Save failed — saved locally')}
        </div>
      )}
      <div className="wizard-domain-badge">
        {isArabic ? domain.nameAr : domain.nameEn}
        {domains.length > 1 ? ` · ${domainIndex + 1}/${domains.length}` : ''}
      </div>
      <div className="wizard-question-card">
        <span className="wizard-question-number">{isArabic ? `س${currentIndex + 1}` : `Q${currentIndex + 1}`}</span>
        <h2 className="wizard-question-text">{isArabic ? question.textAr : question.textEn}</h2>
        {helpText ? (
          <div className="wizard-help">
            <button type="button" className="wizard-help-toggle" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? (isArabic ? 'إخفاء المساعدة' : 'Hide help') : (isArabic ? 'ما المقصود؟' : "What's this?")}
            </button>
            {showHelp ? <p className="wizard-help-text">{helpText}</p> : null}
          </div>
        ) : null}
      </div>
      {question.calculatorType ? (
        <AssessmentCalculator
          type={question.calculatorType}
          isArabic={isArabic}
          initialInputs={calcInputs[question.questionId] ?? null}
          currentScore={selectedScore}
          saving={saving}
          onSave={handleCalculatorSave}
        />
      ) : (
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
      )}
      {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
      <div className="wizard-nav">
        <button className="secondary-btn" onClick={handleBack} disabled={currentIndex === 0} type="button">{isArabic ? '→ السابق' : '← Previous'}</button>
        <button className="primary-btn" onClick={handleNext} disabled={selectedScore === undefined} type="button">{isLast ? (isArabic ? 'إرسال التقييم' : 'Submit assessment') : (isArabic ? 'التالي ←' : 'Next →')}</button>
      </div>
    </div>
  );
}
