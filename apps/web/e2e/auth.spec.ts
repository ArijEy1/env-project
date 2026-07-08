import { test, expect } from '@playwright/test';
import { useEnglish, unique, fetchOtp, apiLogin, seedSession, SUPERADMIN } from './helpers';

test.describe('Authentication', () => {
  test.beforeEach(async ({ context }) => {
    await useEnglish(context);
  });

  test('full sign-up: register → OTP → account dashboard', async ({ page, request }) => {
    const email = `${unique('signup')}@example.com`;
    await page.goto('/register');

    // Organization details
    await page.getByPlaceholder('Enter name in Arabic').fill('منشأة اختبار');
    await page.getByPlaceholder(/e\.g\. 1010234567/).fill(unique('CR').toUpperCase());
    await page.locator('.register-field select').nth(0).selectOption({ index: 1 }); // sector
    await page.locator('.register-field select').nth(1).selectOption({ index: 1 }); // entity type
    await page.locator('.register-field select').nth(2).selectOption({ index: 1 }); // exposure
    await page.getByPlaceholder('e.g. Riyadh', { exact: true }).fill('Riyadh');

    // Admin account
    await page.getByPlaceholder('Enter first name').fill('E2E');
    await page.getByPlaceholder('Enter email address').fill(email);
    await page.getByPlaceholder('Enter password', { exact: true }).fill('TestPass123');
    await page.getByPlaceholder('Re-enter password').fill('TestPass123');

    await page.locator('button.register-submit-button').click();

    // OTP step appears
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    const code = await fetchOtp(request, email);
    await page.locator('input.otp-input').fill(code);
    await page.getByRole('button', { name: 'Verify' }).click();

    // Lands on the account page, authenticated
    await page.waitForURL('**/account');
    await expect(page.getByRole('heading', { name: /Welcome, E2E/ })).toBeVisible();
  });

  test('login with seeded superadmin lands on account', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(SUPERADMIN.email);
    await page.locator('input[type="password"]').fill(SUPERADMIN.password);
    await page.locator('button.login-submit').click();
    await page.waitForURL('**/account');
    await expect(page.getByRole('heading', { name: /Welcome, Platform/ })).toBeVisible();
  });

  test('login with wrong password shows an error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(SUPERADMIN.email);
    await page.locator('input[type="password"]').fill('WrongPass999');
    await page.locator('button.login-submit').click();
    await expect(page.locator('.auth-feedback-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('register form blocks mismatched passwords', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Enter name in Arabic').fill('منشأة');
    await page.getByPlaceholder(/e\.g\. 1010234567/).fill('CR-MISMATCH-1');
    await page.locator('.register-field select').nth(0).selectOption({ index: 1 });
    await page.locator('.register-field select').nth(1).selectOption({ index: 1 });
    await page.locator('.register-field select').nth(2).selectOption({ index: 1 });
    await page.getByPlaceholder('e.g. Riyadh', { exact: true }).fill('Riyadh');
    await page.getByPlaceholder('Enter first name').fill('E2E');
    await page.getByPlaceholder('Enter email address').fill(`${unique('mm')}@example.com`);
    await page.getByPlaceholder('Enter password', { exact: true }).fill('TestPass123');
    await page.getByPlaceholder('Re-enter password').fill('Different123');
    await page.locator('button.register-submit-button').click();
    await expect(page.locator('.auth-feedback-error')).toContainText(/do not match/i);
  });

  test('authenticated user can log out', async ({ page, context, request }) => {
    const auth = await apiLogin(request, SUPERADMIN.email, SUPERADMIN.password);
    await seedSession(context, auth);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('**/login');
    await expect(page.locator('.site-header-actions').getByText('Guest')).toBeVisible();
  });
});
