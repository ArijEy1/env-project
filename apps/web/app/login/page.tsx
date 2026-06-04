import { AuthForm } from '../../components/auth-form';

export default function LoginPage() {
  return (
    <main className="page-shell auth-background-page login-page-shell">
      <AuthForm mode="login" />
    </main>
  );
}
