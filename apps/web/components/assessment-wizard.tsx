'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAssessment,
  fetchGeneratedQuestions,
  saveAnswer,
  updateProgress,
  submitAssessment,
  type Assessment,
  type GeneratedQuestionsData,
  type GeneratedQuestion,
  type AnswerPayload,
} from '../lib/assessment-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';
import { useToast } from './toast-provider';

interface AssessmentWizardProps {
  assessmentId: string;
}

/** A number-entry question (raw value) vs. an option-select question. */
function isNumericQuestion(q: GeneratedQuestion): boolean {
  const t = (q.answerType ?? '').toLowerCase();
  if (/yes|maturity|trend|single|date|frequency/.test(t)) return false;
  return /numeric|percentage/.test(t) || q.options.length === 0;
}

export function AssessmentWizard({ assessmentId }: AssessmentWizardProps) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';

  const [questionsData, setQuestionsData] = useState<GeneratedQuestionsData | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Raw selection per question id (optionIndex / number / attribution).
  const [answers, setAnswers] = useState<Record<string, AnswerPayload>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [numberDraft, setNumberDraft] = useState<string>('');
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshQuestions = useCallback(async () => {
    const qData = await fetchGeneratedQuestions(assessmentId);
    setQuestionsData(qData);
    return qData;
  }, [assessmentId]);

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
        const answerMap: Record<string, AnswerPayload> = {};
        for (const a of aData.answers) {
          const raw = a.rawAnswer ?? {};
          answerMap[a.questionId] = {
            optionIndex: raw.optionIndex ?? undefined,
            number: raw.number ?? undefined,
            attribution: raw.attribution ?? undefined,
          };
        }
        setAnswers(answerMap);
      } catch (err) {
        setError(
          err instanceof Error
            ? translateError(err.message, isArabic)
            : isArabic ? 'فشل تحميل التقييم' : 'Failed to load assessment',
        );
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

  const { questions, domains } = questionsData;
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    return (
      <div className="wizard-error">
        <p className="auth-feedback auth-feedback-error">{isArabic ? 'لا توجد أسئلة لهذا التقييم.' : 'No questions for this assessment.'}</p>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, totalQuestions - 1);
  const question = questions[safeIndex];
  const domain = domains.find((d) => d.id === question.domainId) ?? { id: question.domainId, nameAr: question.domainId, nameEn: question.domainId };
  const answer = answers[question.questionId];
  const numeric = isNumericQuestion(question);
  const isAnswered = answer != null && (answer.optionIndex != null || answer.number != null);
  const nextQuestion = questions[safeIndex + 1];
  const crossesDomain = !!nextQuestion && nextQuestion.domainId !== question.domainId;
  const isLast = safeIndex === totalQuestions - 1;
  const answeredCount = questions.filter((q) => {
    const a = answers[q.questionId];
    return a != null && (a.optionIndex != null || a.number != null);
  }).length;
  const helpText = isArabic ? question.helpTextAr : question.helpTextEn;
  const guidance = isArabic ? question.guidanceAr : question.guidanceEn;
  const domainIndex = domains.findIndex((d) => d.id === question.domainId);
  const domainProgress = domains.map((d) => {
    const qs = questions.filter((q) => q.domainId === d.id);
    const answered = qs.filter((q) => {
      const a = answers[q.questionId];
      return a != null && (a.optionIndex != null || a.number != null);
    }).length;
    return { id: d.id, name: isArabic ? d.nameAr : d.nameEn, answered, total: qs.length };
  });

  async function persist(q: GeneratedQuestion, payload: AnswerPayload) {
    setSaving(true);
    setSaveStatus('saving');
    setError('');
    try {
      await saveAnswer(assessmentId, q.questionId, payload);
      setSaveStatus('saved');
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 1600);
      // A profile/applicability answer can add or remove downstream questions.
      if (q.isRouting) await refreshQuestions();
    } catch {
      setSaveStatus('failed');
      showToast(isArabic ? 'فشل الحفظ، حاول مرة أخرى' : 'Save failed, please retry', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleSelectOption(optionIndex: number) {
    const payload: AnswerPayload = {
      optionIndex,
      ...(question.attributionRequired && answer?.attribution ? { attribution: answer.attribution } : {}),
    };
    setAnswers((prev) => ({ ...prev, [question.questionId]: { ...prev[question.questionId], ...payload } }));
    void persist(question, payload);
  }

  function handleAttribution(text: string) {
    setAnswers((prev) => ({
      ...prev,
      [question.questionId]: { ...prev[question.questionId], attribution: text },
    }));
  }

  function commitNumber() {
    const value = numberDraft.trim();
    if (value === '') return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const payload: AnswerPayload = { number: num };
    setAnswers((prev) => ({ ...prev, [question.questionId]: payload }));
    void persist(question, payload);
  }

  function goToIndex(index: number) {
    setCurrentIndex(index);
    setShowTransition(false);
    setShowHelp(false);
    setNumberDraft('');
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
    goToIndex(safeIndex + 1);
  }

  function handleBack() {
    if (showTransition) {
      setShowTransition(false);
      return;
    }
    if (safeIndex > 0) goToIndex(safeIndex - 1);
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

  if (showTransition && nextQuestion) {
    const nextDomain = domains.find((d) => d.id === nextQuestion.domainId)!;
    return (
      <div className="wizard-shell">
        <div className="wizard-progress">
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${((safeIndex + 1) / totalQuestions) * 100}%` }} />
          </div>
          <span className="wizard-progress-text">{safeIndex + 1} / {totalQuestions}</span>
        </div>
        <div className="wizard-transition-card">
          <div className="wizard-transition-check">&#10003;</div>
          <h2>{isArabic ? `تم الانتهاء من ${domain.nameAr}` : `${domain.nameEn} complete`}</h2>
          <p>{isArabic ? `الآن ننتقل إلى: ${nextDomain.nameAr}` : `Now starting: ${nextDomain.nameEn}`}</p>
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={handleBack} type="button">{isArabic ? '→ رجوع' : '← Back'}</button>
            <button className="primary-btn" onClick={() => goToIndex(safeIndex + 1)} type="button">{isArabic ? 'متابعة ←' : 'Continue →'}</button>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="wizard-shell">
        <div className="wizard-transition-card">
          <h2>{isArabic ? 'تأكيد الإرسال' : 'Confirm submission'}</h2>
          <p>{isArabic ? `لقد أجبت على ${answeredCount} من ${totalQuestions} سؤال منطبق. هل تريد إرسال التقييم؟` : `You have answered ${answeredCount} of ${totalQuestions} applicable questions. Submit the assessment?`}</p>
          {answeredCount < totalQuestions && (
            <p className="wizard-confirm-warning">{isArabic ? 'تنبيه: يجب الإجابة على جميع الأسئلة المنطبقة قبل الإرسال.' : 'Note: all applicable questions must be answered before submitting.'}</p>
          )}
          {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
          <div className="wizard-nav">
            <button className="secondary-btn" onClick={() => setShowConfirm(false)} type="button">{isArabic ? 'إلغاء' : 'Cancel'}</button>
            <button className="primary-btn" onClick={handleSubmit} disabled={submitting || answeredCount < totalQuestions} type="button">{submitting ? (isArabic ? 'جاري الإرسال...' : 'Submitting...') : (isArabic ? 'إرسال التقييم' : 'Submit assessment')}</button>
          </div>
        </div>
      </div>
    );
  }

  const categoryLabel = (cat: string | null): string | null => {
    if (!cat) return null;
    const map: Record<string, [string, string]> = {
      Profile: ['ملف الجهة', 'Profile'],
      Applicability: ['الانطباق', 'Applicability'],
      Core: ['أساسي', 'Core'],
      Conditional: ['مشروط', 'Conditional'],
      Advanced: ['متقدم', 'Advanced'],
    };
    const m = map[cat];
    return m ? (isArabic ? m[0] : m[1]) : cat;
  };

  return (
    <div className="wizard-shell">
      <div className="wizard-progress">
        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${((safeIndex + 1) / totalQuestions) * 100}%` }} />
        </div>
        <span className="wizard-progress-text">{safeIndex + 1} / {totalQuestions}</span>
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
          {saveStatus === 'failed' && (isArabic ? 'فشل الحفظ' : 'Save failed')}
        </div>
      )}
      <div className="wizard-domain-badge">
        {isArabic ? domain.nameAr : domain.nameEn}
        {domains.length > 1 ? ` · ${domainIndex + 1}/${domains.length}` : ''}
        {question.category ? <span className="wizard-cat-tag">{categoryLabel(question.category)}</span> : null}
      </div>
      <div className="wizard-question-card">
        <span className="wizard-question-number">{isArabic ? `س${safeIndex + 1}` : `Q${safeIndex + 1}`}</span>
        <h2 className="wizard-question-text">{isArabic ? question.textAr : question.textEn}</h2>
        {question.isRouting ? (
          <p className="wizard-routing-note">
            {isArabic
              ? 'هذا السؤال يحدد الأسئلة المنطبقة على منشأتكم.'
              : 'This question determines which questions apply to your organization.'}
          </p>
        ) : null}
        {helpText ? (
          <div className="wizard-help">
            <button type="button" className="wizard-help-toggle" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? (isArabic ? 'إخفاء المساعدة' : 'Hide help') : (isArabic ? 'ما المقصود؟' : "What's this?")}
            </button>
            {showHelp ? <p className="wizard-help-text">{helpText}</p> : null}
          </div>
        ) : null}
        {!helpText && guidance ? (
          <div className="wizard-help">
            <button type="button" className="wizard-help-toggle" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? (isArabic ? 'إخفاء الإرشاد' : 'Hide guidance') : (isArabic ? 'إرشاد' : 'Guidance')}
            </button>
            {showHelp ? <p className="wizard-help-text">{guidance}</p> : null}
          </div>
        ) : null}
      </div>

      {numeric ? (
        <div className="wizard-number">
          <label className="wizard-number-label" htmlFor="wizard-number-input">
            {isArabic ? 'أدخل القيمة' : 'Enter value'}
            {question.options[0]?.labelAr ? (
              <span className="wizard-number-unit"> · {isArabic ? question.options[0].labelAr : (question.options[0].labelEn ?? question.options[0].labelAr)}</span>
            ) : null}
          </label>
          <div className="wizard-number-row">
            <input
              id="wizard-number-input"
              className="wizard-number-input"
              type="number"
              inputMode="decimal"
              value={numberDraft !== '' ? numberDraft : (answer?.number ?? '')}
              onChange={(e) => setNumberDraft(e.target.value)}
              onBlur={commitNumber}
              placeholder={isArabic ? 'رقم' : 'Number'}
              disabled={saving}
            />
            <button type="button" className="secondary-btn" onClick={commitNumber} disabled={saving}>
              {isArabic ? 'حفظ' : 'Save'}
            </button>
          </div>
          {answer?.number != null ? (
            <p className="wizard-number-saved">{isArabic ? 'القيمة المحفوظة:' : 'Saved value:'} <strong>{answer.number}</strong></p>
          ) : null}
        </div>
      ) : (
        <div className="wizard-options">
          {question.options.map((option) => {
            const selected = answer?.optionIndex === option.index;
            return (
              <button
                key={option.index}
                className={`wizard-option ${selected ? 'wizard-option-selected' : ''}`}
                onClick={() => handleSelectOption(option.index)}
                disabled={saving}
                type="button"
              >
                <span className="wizard-option-radio">{selected ? '●' : '○'}</span>
                <span className="wizard-option-label">
                  {option.level != null ? <span className="wizard-option-level">{option.level}</span> : null}
                  {isArabic ? option.labelAr : (option.labelEn ?? option.labelAr)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {question.attributionRequired && isAnswered ? (
        <div className="wizard-attribution">
          <label htmlFor="wizard-attr">
            {isArabic
              ? 'إثبات التحسن (اختياري): صف المبادرة أو خط الأساس الذي يفسر التغير.'
              : 'Attribution (optional): describe the initiative or baseline behind the change.'}
          </label>
          <input
            id="wizard-attr"
            className="wizard-attr-input"
            type="text"
            value={answer?.attribution ?? ''}
            onChange={(e) => handleAttribution(e.target.value)}
            onBlur={() => answer?.optionIndex != null && persist(question, { optionIndex: answer.optionIndex, attribution: answer.attribution })}
            placeholder={isArabic ? 'مثال: مشروع كفاءة الطاقة 2025' : 'e.g. 2025 energy-efficiency project'}
          />
        </div>
      ) : null}

      {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
      <div className="wizard-nav">
        <button className="secondary-btn" onClick={handleBack} disabled={safeIndex === 0} type="button">{isArabic ? '→ السابق' : '← Previous'}</button>
        <button className="primary-btn" onClick={handleNext} disabled={!isAnswered} type="button">{isLast ? (isArabic ? 'مراجعة وإرسال' : 'Review & submit') : (isArabic ? 'التالي ←' : 'Next →')}</button>
      </div>
    </div>
  );
}
