import { PasswordResetForm } from '../../components/password-reset-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string | string[] }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0] ?? ''
    : resolvedSearchParams.token ?? '';

  return (
    <main className="page-shell auth-background-page login-page-shell">
      <PasswordResetForm mode="reset" token={token} />
    </main>
  );
}