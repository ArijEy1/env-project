'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  requestPasswordReset,
  resetPassword,
} from '../lib/auth-client';
import { useLanguage } from './language-provider';

interface PasswordResetFormProps {
  mode: 'request' | 'reset';
  token?: string;
}

export function PasswordResetForm({ mode, token = '' }: PasswordResetFormProps) {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isArabic = language === 'ar';
  const isResetMode = mode === 'reset';

  const content = useMemo(
    () =>
      isResetMode
        ? {
            title: isArabic ? 'إعادة تعيين كلمة المرور' : 'Reset your password',
            description: isArabic
              ? 'أدخل كلمة مرور جديدة لتأمين حسابك ثم تابع تسجيل الدخول.'
              : 'Enter a new password for your account and sign in again.',
            submitLabel: isArabic ? 'حفظ كلمة المرور' : 'Save new password',
            successMessage: isArabic
              ? 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.'
              : 'Your password has been updated. You can now log in.',
          }
        : {
            title: isArabic ? 'استعادة كلمة المرور' : 'Forgot your password?',
            description: isArabic
              ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.'
              : 'Enter your email address and we will send you a reset link.',
            submitLabel: isArabic ? 'إرسال رابط التحقق' : 'Send reset link',
            successMessage: isArabic
              ? 'إذا كان البريد الإلكتروني مسجلاً لدينا، فستصلك رسالة لإعادة تعيين كلمة المرور.'
              : 'If that email exists in our records, a reset link has been sent.',
          },
    [isArabic, isResetMode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (isResetMode) {
        if (!token) {
          throw new Error(
            isArabic
              ? 'رابط إعادة التعيين غير صالح أو ناقص.'
              : 'The reset link is invalid or incomplete.',
          );
        }

        if (password.trim().length < 8) {
          throw new Error(
            isArabic
              ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.'
              : 'Password must be at least 8 characters.',
          );
        }

        if (password !== confirmPassword) {
          throw new Error(
            isArabic
              ? 'كلمتا المرور غير متطابقتين.'
              : 'Passwords do not match.',
          );
        }

        const response = await resetPassword({ token, password });
        setSuccessMessage(response.message || content.successMessage);
        setPassword('');
        setConfirmPassword('');
      } else {
        const response = await requestPasswordReset({ email: email.trim() });
        setSuccessMessage(response.message || content.successMessage);
        setEmail('');
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : isArabic
            ? 'تعذر تنفيذ الطلب حالياً.'
            : 'Unable to process the request right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="password-reset-shell">
      <div className="password-reset-card">
        <span className="section-label password-reset-badge">
          {isResetMode
            ? isArabic
              ? 'تأكيد الملكية'
              : 'Verify ownership'
            : isArabic
              ? 'استعادة الوصول'
              : 'Recover access'}
        </span>
        <h1>{content.title}</h1>
        <p className="password-reset-description">{content.description}</p>

        <form className="password-reset-form" onSubmit={handleSubmit}>
          {isResetMode ? (
            <>
              <label className="register-field">
                <span>{isArabic ? 'كلمة المرور الجديدة' : 'New password'}</span>
                <div className="password-field-wrapper register-password-field-wrapper">
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isArabic ? 'أدخل كلمة المرور الجديدة' : 'Enter your new password'}
                    minLength={8}
                    required
                  />
                  <button
                    aria-label={isPasswordVisible ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : isArabic ? 'إظهار كلمة المرور' : 'Show password'}
                    className="password-toggle-button register-password-toggle"
                    onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                    type="button"
                  >
                    {isPasswordVisible ? '•' : '◦'}
                  </button>
                </div>
              </label>

              <label className="register-field">
                <span>{isArabic ? 'تأكيد كلمة المرور' : 'Confirm password'}</span>
                <div className="password-field-wrapper register-password-field-wrapper">
                  <input
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={isArabic ? 'أعد إدخال كلمة المرور' : 'Re-enter your password'}
                    minLength={8}
                    required
                  />
                  <button
                    aria-label={isConfirmPasswordVisible ? (isArabic ? 'إخفاء تأكيد كلمة المرور' : 'Hide confirm password') : isArabic ? 'إظهار تأكيد كلمة المرور' : 'Show confirm password'}
                    className="password-toggle-button register-password-toggle"
                    onClick={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? '•' : '◦'}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email address'}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isArabic ? 'ادخل بريدك الإلكتروني' : 'Enter your email'}
                required
              />
            </label>
          )}

          {error ? <p className="auth-feedback auth-feedback-error register-feedback">{error}</p> : null}
          {successMessage ? <p className="auth-feedback auth-feedback-success register-feedback">{successMessage}</p> : null}

          <div className="password-reset-actions">
            <Link className="secondary-btn register-cancel-button" href="/login">
              {isArabic ? 'العودة لتسجيل الدخول' : 'Back to login'}
            </Link>
            <button className="primary-btn register-submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? isArabic
                  ? 'يرجى الانتظار...'
                  : 'Please wait...'
                : content.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}