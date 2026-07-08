import { APIRequestContext, BrowserContext, Page, expect } from '@playwright/test';

export const API_BASE = 'http://localhost:4000/api';

export const SUPERADMIN = {
  email: 'admin@env-project.sa',
  password: 'AdminPass123',
};

const TOKEN_KEY = 'env-project-token';
const USER_KEY = 'env-project-user';
const REFRESHED_KEY = 'env-project-token-refreshed-at';
const LANG_KEY = 'env-project-language';

/** Unique-ish suffix so repeated runs don't collide on email / CR number. */
export function unique(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Force the app into English before any page script runs, so assertions can key
 * off stable English copy. Applies to every navigation in the context.
 */
export async function useEnglish(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([langKey]) => {
      window.localStorage.setItem(langKey, 'en');
    },
    [LANG_KEY],
  );
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; role: string; firstName: string };
}

/** Log in through the API and return the session (token + user). */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthResult> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login failed for ${email}: ${res.status()}`).toBeTruthy();
  return (await res.json()) as AuthResult;
}

/**
 * Seed an authenticated session into localStorage before the page loads, so the
 * app boots already logged in (and in English). Use for tests that aren't about
 * the login UI itself.
 */
export async function seedSession(
  context: BrowserContext,
  auth: AuthResult,
): Promise<void> {
  await context.addInitScript(
    ([token, user, keys]) => {
      const [tokenKey, userKey, refreshedKey, langKey] = keys;
      window.localStorage.setItem(tokenKey, token);
      window.localStorage.setItem(userKey, user);
      window.localStorage.setItem(refreshedKey, String(Date.now()));
      window.localStorage.setItem(langKey, 'en');
    },
    [
      auth.accessToken,
      JSON.stringify(auth.user),
      [TOKEN_KEY, USER_KEY, REFRESHED_KEY, LANG_KEY],
    ] as const,
  );
}

/** Read the OTP the API would have emailed, via the dev-only test seam. */
export async function fetchOtp(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.get(
    `${API_BASE}/test/otp?email=${encodeURIComponent(email)}`,
  );
  expect(res.ok(), `OTP seam returned ${res.status()} for ${email}`).toBeTruthy();
  const body = (await res.json()) as { code: string };
  expect(body.code).toMatch(/^\d{6}$/);
  return body.code;
}

/** Switch the live UI language via the navbar toggle. */
export async function switchLanguage(page: Page, lang: 'AR' | 'EN'): Promise<void> {
  await page.locator('.language-switcher-button', { hasText: lang }).click();
}

/**
 * Register + verify a brand-new organization admin entirely through the API
 * (using the OTP seam), returning a clean authenticated session with no drafts.
 */
export async function registerVerifiedUser(
  request: APIRequestContext,
  firstName = 'Flow',
): Promise<AuthResult & { email: string }> {
  const email = `${unique('user')}@example.com`;
  const reg = await request.post(`${API_BASE}/auth/register`, {
    data: {
      entity: {
        nameAr: 'منشأة تدفق',
        nameEn: 'Flow Co',
        crNumber: unique('CR').toUpperCase(),
        sector: 'services',
        entityType: 'private_company',
        environmentalExposure: 'low',
        city: 'Riyadh',
      },
      user: { firstName, email, password: 'TestPass123' },
    },
  });
  expect(reg.ok(), `register failed: ${reg.status()}`).toBeTruthy();
  const code = await fetchOtp(request, email);
  const verify = await request.post(`${API_BASE}/auth/verify-otp`, {
    data: { email, code },
  });
  expect(verify.ok(), `verify failed: ${verify.status()}`).toBeTruthy();
  const body = (await verify.json()) as AuthResult;
  return { ...body, email };
}
