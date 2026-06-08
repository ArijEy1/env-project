'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  authStorage,
  loginUser,
  registerUser,
  type AuthResponse,
} from '../lib/auth-client';
import { translateError } from '../lib/error-messages';
import { useLanguage } from './language-provider';
import { useToast } from './toast-provider';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  mode: AuthMode;
}

const SECTORS = [
  { value: 'industrial', ar: 'صناعي', en: 'Industrial' },
  { value: 'oil_and_gas', ar: 'نفط وغاز', en: 'Oil & Gas' },
  { value: 'manufacturing', ar: 'تصنيع', en: 'Manufacturing' },
  { value: 'construction', ar: 'إنشاءات', en: 'Construction' },
  { value: 'services', ar: 'خدمات', en: 'Services' },
  { value: 'government', ar: 'حكومي', en: 'Government' },
  { value: 'healthcare', ar: 'رعاية صحية', en: 'Healthcare' },
  { value: 'education', ar: 'تعليم', en: 'Education' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

const EMPLOYEE_BRACKETS = [
  { value: '1-10', label: '1 – 10' },
  { value: '11-50', label: '11 – 50' },
  { value: '51-200', label: '51 – 200' },
  { value: '201-500', label: '201 – 500' },
  { value: '501-1000', label: '501 – 1000' },
  { value: '1000+', label: '1000+' },
];

export function AuthForm({ mode }: AuthFormProps) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const isRegister = mode === 'register';

  // Entity fields
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [sector, setSector] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [employeeBracket, setEmployeeBracket] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [unifiedNumber, setUnifiedNumber] = useState('');

  // User fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  // UI state
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const content = useMemo(
    () =>
      isRegister
        ? {
            title: isArabic ? 'إنشاء حساب جديد' : 'Create a new account',
            submitLabel: isArabic ? 'إنشاء الحساب' : 'Create account',
            alternateText: isArabic ? 'لديك حساب بالفعل؟' : 'Already have an account?',
            alternateHref: '/login',
            alternateLabel: isArabic ? 'تسجيل الدخول' : 'Log in',
          }
        : {
            title: isArabic ? 'تسجيل الدخول إلى المنصة' : 'Log in to the platform',
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
      if (isRegister) {
        if (!nameAr.trim()) {
          throw new Error(isArabic ? 'اسم المنشأة بالعربية مطلوب.' : 'Organization name (Arabic) is required.');
        }
        if (!crNumber.trim()) {
          throw new Error(isArabic ? 'رقم السجل التجاري مطلوب.' : 'CR number is required.');
        }
        if (!sector) {
          throw new Error(isArabic ? 'القطاع مطلوب.' : 'Sector is required.');
        }
        if (!city.trim()) {
          throw new Error(isArabic ? 'المدينة مطلوبة.' : 'City is required.');
        }
        if (!firstName.trim()) {
          throw new Error(isArabic ? 'الاسم الأول مطلوب.' : 'First name is required.');
        }
        if (!email.trim()) {
          throw new Error(isArabic ? 'البريد الإلكتروني مطلوب.' : 'Email is required.');
        }
        if (!password) {
          throw new Error(isArabic ? 'كلمة المرور مطلوبة.' : 'Password is required.');
        }
        if (password.length < 8) {
          throw new Error(isArabic ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
          throw new Error(isArabic ? 'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم.' : 'Password must contain uppercase, lowercase, and a digit.');
        }
        if (password !== confirmPassword) {
          throw new Error(isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
        }
      }

      const response: AuthResponse = isRegister
        ? await registerUser({
            entity: {
              nameAr: nameAr.trim(),
              nameEn: nameEn.trim() || undefined,
              crNumber: crNumber.trim(),
              sector,
              city: city.trim(),
              region: region.trim() || undefined,
              employeeCountBracket: employeeBracket || undefined,
              contactEmail: contactEmail.trim() || undefined,
              contactPhone: contactPhone.trim() || undefined,
              unifiedNationalNumber: unifiedNumber.trim() || undefined,
            },
            user: {
              firstName: firstName.trim(),
              lastName: lastName.trim() || undefined,
              email: email.trim(),
              phone: phone.trim() || undefined,
              jobRole: jobRole.trim() || undefined,
              password,
            },
          })
        : await loginUser({ email, password });

      localStorage.setItem(authStorage.tokenKey, response.accessToken);
      localStorage.setItem(authStorage.userKey, JSON.stringify(response.user));
      setSuccessMessage(
        isRegister
          ? isArabic ? 'تم إنشاء الحساب بنجاح. يتم تحويلك...' : 'Account created. Redirecting...'
          : isArabic ? 'تم تسجيل الدخول بنجاح. يتم تحويلك...' : 'Login successful. Redirecting...',
      );
      showToast(
        isRegister
          ? (isArabic ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully')
          : (isArabic ? 'تم تسجيل الدخول بنجاح' : 'Login successful'),
        'success',
      );
      window.location.replace('/account');
      return;
    } catch (submissionError) {
      const translatedError = submissionError instanceof Error
        ? translateError(submissionError.message, isArabic)
        : isArabic ? 'تعذر تنفيذ طلبك حاليًا.' : 'Unable to process your request right now.';
      setError(translatedError);
      showToast(translatedError, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordToggleLabel = isPasswordVisible
    ? isArabic ? 'إخفاء كلمة المرور' : 'Hide password'
    : isArabic ? 'إظهار كلمة المرور' : 'Show password';

  const confirmPasswordToggleLabel = isConfirmPasswordVisible
    ? isArabic ? 'إخفاء تأكيد كلمة المرور' : 'Hide confirm password'
    : isArabic ? 'إظهار تأكيد كلمة المرور' : 'Show confirm password';

  const eyeOpen = (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );

  const eyeClosed = (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 4.5L19.5 21" />
      <path d="M10.58 10.58A2 2 0 0013.4 13.4" />
      <path d="M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.58" />
      <path d="M6.61 6.61A11.84 11.84 0 001.5 12c.67 2.16 2.2 4.05 4.21 5.4A10.8 10.8 0 0012 19.1c1.3 0 2.54-.22 3.68-.62" />
    </svg>
  );

  // --- LOGIN FORM ---
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
              <p>{isArabic ? 'سجّل الدخول للوصول إلى حسابك ومتابعة تقييمات الامتثال والتقارير البيئية بسهولة.' : 'Sign in to access your account and continue your compliance assessments and environmental reports.'}</p>
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
            <p>{isArabic ? 'أدخل بياناتك للوصول إلى حسابك.' : 'Enter your details to access your account.'}</p>
          </div>

          <form className="auth-form login-form" onSubmit={handleSubmit}>
            <label className="auth-field login-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email address'}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isArabic ? 'ادخل بريدك الإلكتروني' : 'Enter your email'} required />
            </label>

            <label className="auth-field login-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'}</span>
              <div className="password-field-wrapper">
                <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter your password'} minLength={8} required />
                <button aria-label={passwordToggleLabel} className="password-toggle-button" onClick={() => setIsPasswordVisible((v) => !v)} type="button">
                  {isPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
            </label>

            <div className="login-form-options">
              <label className="login-remember-option">
                <input checked={rememberSession} onChange={(e) => setRememberSession(e.target.checked)} type="checkbox" />
                <span>{isArabic ? 'تذكرني' : 'Remember me'}</span>
              </label>
              <Link className="login-forgot-link" href="/forgot-password">{isArabic ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</Link>
            </div>

            {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}
            {successMessage ? <p className="auth-feedback auth-feedback-success">{successMessage}</p> : null}

            <button className="primary-btn auth-submit login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'تسجيل الدخول' : 'Log in')}
            </button>
          </form>

          <div className="login-form-divider"><span>{isArabic ? 'أو' : 'Or'}</span></div>

          <p className="auth-switch-link login-switch-link">
            {content.alternateText} <Link href={content.alternateHref}>{content.alternateLabel}</Link>
          </p>
        </div>
      </section>
    );
  }

  // --- REGISTER FORM ---
  return (
    <section className="register-shell">
      <div className="register-card">
        <div className="register-card-header">
          <h1>{isArabic ? 'تسجيل منشأة جديدة' : 'Register a new organization'}</h1>
          <p>{isArabic ? 'أدخل بيانات المنشأة ثم أنشئ حسابك كمسؤول.' : 'Enter organization details, then create your admin account.'}</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          {/* Section 1: Organization */}
          <div className="register-section-heading">
            <span>{isArabic ? 'بيانات المنشأة' : 'Organization details'}</span>
          </div>

          <div className="register-form-grid">
            <label className="register-field">
              <span>{isArabic ? 'اسم المنشأة (عربي)' : 'Organization name (Arabic)'} <em>*</em></span>
              <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={isArabic ? 'ادخل اسم المنشأة بالعربية' : 'Enter name in Arabic'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'اسم المنشأة (إنجليزي)' : 'Organization name (English)'}</span>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder={isArabic ? 'ادخل اسم المنشأة بالإنجليزية' : 'Enter name in English'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'رقم السجل التجاري' : 'CR number'} <em>*</em></span>
              <input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} placeholder={isArabic ? 'مثال: 1010234567' : 'e.g. 1010234567'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'القطاع' : 'Sector'} <em>*</em></span>
              <select value={sector} onChange={(e) => setSector(e.target.value)} required>
                <option value="">{isArabic ? 'اختر القطاع' : 'Select sector'}</option>
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{isArabic ? s.ar : s.en}</option>
                ))}
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'المدينة' : 'City'} <em>*</em></span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={isArabic ? 'مثال: الرياض' : 'e.g. Riyadh'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'المنطقة' : 'Region'}</span>
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={isArabic ? 'مثال: منطقة الرياض' : 'e.g. Riyadh Region'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'عدد الموظفين' : 'Number of employees'}</span>
              <select value={employeeBracket} onChange={(e) => setEmployeeBracket(e.target.value)}>
                <option value="">{isArabic ? 'اختر الفئة' : 'Select bracket'}</option>
                {EMPLOYEE_BRACKETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني للمنشأة' : 'Organization email'}</span>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={isArabic ? 'info@company.sa' : 'info@company.sa'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'هاتف المنشأة' : 'Organization phone'}</span>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder={isArabic ? '+966112345678' : '+966112345678'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الرقم الموحد' : 'Unified national number'}</span>
              <input value={unifiedNumber} onChange={(e) => setUnifiedNumber(e.target.value)} placeholder={isArabic ? '7001234567' : '7001234567'} />
            </label>
          </div>

          {/* Section 2: User Account */}
          <div className="register-section-heading register-section-heading-account">
            <span>{isArabic ? 'حسابك' : 'Your account'}</span>
          </div>

          <div className="register-form-grid">
            <label className="register-field">
              <span>{isArabic ? 'الاسم الأول' : 'First name'} <em>*</em></span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={isArabic ? 'ادخل الاسم الأول' : 'Enter first name'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الاسم الأخير' : 'Last name'}</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={isArabic ? 'ادخل الاسم الأخير' : 'Enter last name'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'البريد الإلكتروني' : 'Email'} <em>*</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isArabic ? 'ادخل البريد الإلكتروني' : 'Enter email address'} required />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'رقم الجوال' : 'Mobile number'}</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isArabic ? '05XXXXXXXX' : '05XXXXXXXX'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'الدور الوظيفي' : 'Job role'}</span>
              <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder={isArabic ? 'مثال: مدير بيئي' : 'e.g. Environmental Manager'} />
            </label>

            <label className="register-field">
              <span>{isArabic ? 'كلمة المرور' : 'Password'} <em>*</em></span>
              <div className="password-field-wrapper register-password-field-wrapper">
                <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? 'ادخل كلمة المرور' : 'Enter password'} minLength={8} required />
                <button aria-label={passwordToggleLabel} className="password-toggle-button register-password-toggle" onClick={() => setIsPasswordVisible((v) => !v)} type="button">
                  {isPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
              <small className="register-password-hint">{isArabic ? '8 أحرف على الأقل، حرف كبير، حرف صغير، ورقم' : 'Min 8 chars, uppercase, lowercase, and a digit'}</small>
            </label>

            <label className="register-field">
              <span>{isArabic ? 'تأكيد كلمة المرور' : 'Confirm password'} <em>*</em></span>
              <div className="password-field-wrapper register-password-field-wrapper">
                <input type={isConfirmPasswordVisible ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={isArabic ? 'أعد إدخال كلمة المرور' : 'Re-enter password'} minLength={8} required />
                <button aria-label={confirmPasswordToggleLabel} className="password-toggle-button register-password-toggle" onClick={() => setIsConfirmPasswordVisible((v) => !v)} type="button">
                  {isConfirmPasswordVisible ? eyeClosed : eyeOpen}
                </button>
              </div>
            </label>
          </div>

          {error ? <p className="auth-feedback auth-feedback-error register-feedback">{error}</p> : null}
          {successMessage ? <p className="auth-feedback auth-feedback-success register-feedback">{successMessage}</p> : null}

          <div className="register-actions">
            <Link className="secondary-btn register-cancel-button" href="/login">{isArabic ? 'إلغاء' : 'Cancel'}</Link>
            <button className="primary-btn register-submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? (isArabic ? 'يرجى الانتظار...' : 'Please wait...') : (isArabic ? 'إنشاء الحساب' : 'Create account')}
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
