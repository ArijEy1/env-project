import { PasswordResetForm } from '../../components/password-reset-form';

export default function ForgotPasswordPage() {
  return (
    <main className="page-shell auth-background-page login-page-shell">
      <PasswordResetForm mode="request" />
    </main>
  );
}