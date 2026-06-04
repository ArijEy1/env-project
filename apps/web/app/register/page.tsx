import { AuthForm } from '../../components/auth-form';

export default function RegisterPage() {
  return (
    <main className="page-shell auth-background-page register-page-shell">
      <AuthForm mode="register" />
    </main>
  );
}
