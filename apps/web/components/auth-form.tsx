'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  authStorage,
  loginUser,
  registerUser,
  type AuthResponse,
} from '../lib/auth-client';
import { useLanguage } from './language-provider';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  mode: AuthMode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const { language } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+966');
  const [entity, setEntity] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isRegister = mode === 'register';
  const isArabic = language === 'ar';

  const content = useMemo(
    () =>
      isRegister
        ? {
            title: isArabic ? 'إنشاء حساب جديد' : 'Create a new account',
            description:
              isArabic
                ? 'سجّل مستخدمًا جديدًا عبر واجهة `NestJS` وابدأ جلسة مصادقة باستخدام JWT مباشرة.'
                : 'Register a new user through the NestJS API and start a JWT session immediately.',
            submitLabel: isArabic ? 'إنشاء الحساب' : 'Create account',
            alternateText: isArabic ? 'لديك حساب بالفعل؟' : 'Already have an account?',
            alternateHref: '/login',
            alternateLabel: isArabic ? 'تسجيل الدخول' : 'Log in',
          }
        : {
            title: isArabic ? 'تسجيل الدخول إلى المنصة' : 'Log in to the platform',
            description:
              isArabic
                ? 'قم بالمصادقة عبر واجهة `NestJS` واحفظ رمز JWT محليًا للوصول إلى الصفحات المحمية.'
                : 'Authenticate against the NestJS API and store the JWT locally for protected routes.',
            submitLabel: isArabic ? 'دخول' : 'Log in',
            alternateText: isArabic ? 'لا تملك حسابًا؟' : 'Need an account?',
            alternateHref: '/register',
            alternateLabel: isArabic ? 'إنشاء حساب' : 'Create one',
          },
    [isArabic, isRegister],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const registerFullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const hasPasswordInput = password.trim().length > 0 || confirmPassword.trim().length > 0;
      const generatedPassword = `Temp@${Math.random().toString(36).slice(2, 10)}A1`;

      if (isRegister && !registerFullName) {
        throw new Error(isArabic ? 'الاسم مطلوب.' : 'Name is required.');
      }

      if (isRegister && !email.trim()) {
        throw new Error(isArabic ? 'البريد الإلكتروني مطلوب.' : 'Email is required.');
      }

      if (isRegister && hasPasswordInput && password !== confirmPassword) {
        throw new Error(isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      }

      if (isRegister && hasPasswordInput && password.trim().length < 6) {
        throw new Error(isArabic ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.' : 'Password must be at least 6 characters.');
      }

      const response: AuthResponse = isRegister
        ? await registerUser({ fullName: registerFullName, email, password: hasPasswordInput ? password : generatedPassword })
        : await loginUser({ email, password });

      localStorage.setItem(authStorage.tokenKey, response.accessToken);
      localStorage.setItem(authStorage.userKey, JSON.stringify(response.user));
      setSuccessMessage(
        isRegister
          ? isArabic
            ? 'تم إنشاء الحساب بنجاح. يتم تحويلك إلى الصفحة الرئيسية...'
            : 'Account created successfully. Redirecting to the home page...'
          : isArabic
            ? 'تم تسجيل الدخول بنجاح. يتم تحويلك إلى الصفحة الرئيسية...'
            : 'Login successful. Redirecting to the home page...',
      );
      window.location.replace('/');
      return;
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : isArabic
            ? 'تعذر تنفيذ طلبك حاليًا.'
            : 'Unable to process your request right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordToggleLabel = isPasswordVisible
    ? isArabic
      ? 'إخفاء كلمة المرور'
      : 'Hide password'
    : isArabic
      ? 'إظهار كلمة المرور'
      : 'Show password';

  const confirmPasswordToggleLabel = isConfirmPasswordVisible
    ? isArabic
      ? 'إخفاء تأكيد كلمة المرور'
      : 'Hide confirm password'
    : isArabic
      ? 'إظهار تأكيد كلمة المرور'
      : 'Show confirm password';

  if (!isRegister) {
    return (
      <section className="auth-page-shell auth-page-shell-login">
        <div className="auth-page-card login-visual-panel">
          <div className="login-visual-top">
            <div className="login-brand-lockup">
              <span className="login-brand-mark">NE</span>
              <div className="login-brand-copy">
                <strong>{isArabic ? 'الأداة الوطنية' : 'National Tool'}</strong>
                <span>{isArabic ? 'منصة تقييم الامتثال البيئي' : 'Environmental compliance platform'}</span>
              </div>
            </div>

            <div className="login-visual-copy">
              <span className="section-label login-visual-badge">{isArabic ? 'وصول موثوق' : 'Trusted access'}</span>
              <h1>{isArabic ? 'مرحبًا بك مجددًا' : 'Welcome back'}</h1>
              <p>
                {isArabic
                  ? 'سجّل الدخول للوصول إلى حسابك ومتابعة تقييمات الامتثال والتقارير البيئية بسهولة.'
                  : 'Sign in to access your account and continue your compliance assessments and environmental reports.'}
              </p>
            </div>
          </div>

          <div className="login-benefits-list">
            <div className="login-benefit-item">
              <span className="login-benefit-icon">✓</span>
              <div>
                <strong>{isArabic ? 'تسجيل آمن وموثوق' : 'Secure and trusted sign-in'}</strong>
                <p>{isArabic ? 'مصادقة JWT مع تجربة دخول واضحة وسريعة.' : 'JWT authentication with a clear and fast sign-in flow.'}</p>
              </div>
            </div>
            <div className="login-benefit-item">
              <span className="login-benefit-icon">◎</span>
              <div>
                <strong>{isArabic ? 'تقاريرك في مكان واحد' : 'Your reports in one place'}</strong>
                <p>{isArabic ? 'الوصول إلى نتائجك ولوحات المتابعة بمجرد تسجيل الدخول.' : 'Open your results and monitoring dashboards right after login.'}</p>
              </div>
            </div>
            <div className="login-benefit-item">
              <span className="login-benefit-icon">↗</span>
              <div>
                <strong>{isArabic ? 'رحلة استخدام أبسط' : 'Simpler user journey'}</strong>
                <p>{isArabic ? 'تنقل سريع بين الحساب، المجالات، والتوصيات.' : 'Move quickly across account, domains, and recommendations.'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-page-card auth-form-card login-form-panel">
          <div className="login-form-header">
            <h2>{isArabic ? 'تسجيل الدخول' : 'Log in'}</h2>
            <p>
              {isArabic
                ? 'أدخل بياناتك للوصول إلى حسابك.'
                : 'Enter your details to access your account.'}
            </p>
          </div>

          <form className="auth-form login-form" onSubmit={handleSubmit}>
            <label className="auth-field login-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email address'}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isArabic ? 'ادخل بريدك الإلكتروني' : 'Enter your email'}
                required
              />
            </label>

            <label className="auth-field login-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'}</span>
              <div className="password-field-wrapper">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter your password'}
                  minLength={6}
                  required
                />
                <button
                  aria-label={passwordToggleLabel}
                  className="password-toggle-button"
                  onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                  type="button"
                >
                  {isPasswordVisible ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M3 4.5L19.5 21" />
                      <path d="M10.58 10.58A2 2 0 0013.4 13.4" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.58" />
                      <path d="M6.61 6.61A11.84 11.84 0 001.5 12c.67 2.16 2.2 4.05 4.21 5.4A10.8 10.8 0 0012 19.1c1.3 0 2.54-.22 3.68-.62" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z" />
                      <circle cx="12" cy="12" r="3.2" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <div className="login-form-options">
              <label className="login-remember-option">
                <input
                  checked={rememberSession}
                  onChange={(event) => setRememberSession(event.target.checked)}
                  type="checkbox"
                />
                <span>{isArabic ? 'تذكرني' : 'Remember me'}</span>
              </label>

              <Link className="login-forgot-link" href="/register">
                {isArabic ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
              </Link>
            </div>

            {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}
            {successMessage ? <p className="auth-feedback auth-feedback-success">{successMessage}</p> : null}

            <button className="primary-btn auth-submit login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'تسجيل الدخول' : 'Log in')}
            </button>
          </form>

          <div className="login-form-divider">
            <span>{isArabic ? 'أو' : 'Or'}</span>
          </div>


          <p className="auth-switch-link login-switch-link">
            {content.alternateText} <Link href={content.alternateHref}>{content.alternateLabel}</Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="register-shell">
      <div className="register-card">
        <div className="register-card-header">
          <h1>{isArabic ? 'إنشاء مستخدم جديد' : 'Create a new user'}</h1>
          <p>{isArabic ? 'أدخل المعلومات الأساسية لإضافة مستخدم جديد إلى المنصة.' : 'Enter the core details to add a new user to the platform.'}</p>
        </div>

        <div className="register-section-heading">
          <span>{isArabic ? 'المعلومات الأساسية' : 'Basic information'}</span>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-form-grid">
            <label className="register-field">
              <span>{isArabic ? 'الاسم الأول' : 'First name'} <em>*</em></span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder={isArabic ? 'ادخل الاسم الأول' : 'Enter first name'}
                required
              />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الاسم الأخير' : 'Last name'}</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder={isArabic ? 'ادخل الاسم الأخير' : 'Enter last name'}
              />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email'} <em>*</em></span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isArabic ? 'ادخل البريد الإلكتروني' : 'Enter email address'}
                required
              />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'رقم الجوال' : 'Mobile number'}</span>
              <div className="register-phone-group">
                <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                  <option value="+966">+966</option>
                  <option value="+971">+971</option>
                  <option value="+20">+20</option>
                  <option value="+212">+212</option>
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={isArabic ? '5XXXXXXXX' : '5XXXXXXXX'}
                />
              </div>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الجهة' : 'Entity'}</span>
              <select value={entity} onChange={(event) => setEntity(event.target.value)}>
                <option value="">{isArabic ? 'اختر الجهة' : 'Select entity'}</option>
                <option value="ministry">{isArabic ? 'وزارة' : 'Ministry'}</option>
                <option value="authority">{isArabic ? 'هيئة' : 'Authority'}</option>
                <option value="private-sector">{isArabic ? 'قطاع خاص' : 'Private sector'}</option>
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span>
              <select value={jobRole} onChange={(event) => setJobRole(event.target.value)}>
                <option value="">{isArabic ? 'اختر الدور' : 'Select role'}</option>
                <option value="manager">{isArabic ? 'مدير' : 'Manager'}</option>
                <option value="specialist">{isArabic ? 'أخصائي' : 'Specialist'}</option>
                <option value="reviewer">{isArabic ? 'مراجع' : 'Reviewer'}</option>
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'}</span>
              <div className="password-field-wrapper register-password-field-wrapper">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter password'}
                  minLength={6}
                />
                <button
                  aria-label={passwordToggleLabel}
                  className="password-toggle-button register-password-toggle"
                  onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                  type="button"
                >
                  {isPasswordVisible ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M3 4.5L19.5 21" />
                      <path d="M10.58 10.58A2 2 0 0013.4 13.4" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.58" />
                      <path d="M6.61 6.61A11.84 11.84 0 001.5 12c.67 2.16 2.2 4.05 4.21 5.4A10.8 10.8 0 0012 19.1c1.3 0 2.54-.22 3.68-.62" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z" />
                      <circle cx="12" cy="12" r="3.2" />
                    </svg>
                  )}
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
                  placeholder={isArabic ? 'أعد إدخال كلمة المرور' : 'Re-enter password'}
                  minLength={6}
                />
                <button
                  aria-label={confirmPasswordToggleLabel}
                  className="password-toggle-button register-password-toggle"
                  onClick={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
                  type="button"
                >
                  {isConfirmPasswordVisible ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M3 4.5L19.5 21" />
                      <path d="M10.58 10.58A2 2 0 0013.4 13.4" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.58" />
                      <path d="M6.61 6.61A11.84 11.84 0 001.5 12c.67 2.16 2.2 4.05 4.21 5.4A10.8 10.8 0 0012 19.1c1.3 0 2.54-.22 3.68-.62" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z" />
                      <circle cx="12" cy="12" r="3.2" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
          </div>

          {error ? <p className="auth-feedback auth-feedback-error register-feedback">{error}</p> : null}
          {successMessage ? <p className="auth-feedback auth-feedback-success register-feedback">{successMessage}</p> : null}

          <div className="register-actions">
            <Link className="secondary-btn register-cancel-button" href="/login">
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Link>
            <button className="primary-btn register-submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'حفظ المستخدم' : 'Save user')}
            </button>
          </div>
        </form>

        <p className="register-switch-link">
          {content.alternateText} <Link href={content.alternateHref}>{content.alternateLabel}</Link>
        </p>
      </div>
    </section>
  );
}
