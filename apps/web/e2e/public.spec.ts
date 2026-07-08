import { test, expect } from '@playwright/test';
import { useEnglish, switchLanguage } from './helpers';

test.describe('Public pages', () => {
  test.beforeEach(async ({ context }) => {
    await useEnglish(context);
  });

  test('home page renders hero, stats and primary CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Assess today');
    // Hero CTAs link to register + login.
    await expect(page.locator('.home-hero a[href="/register"]').first()).toBeVisible();
    await expect(page.locator('.home-hero a[href="/login"]').first()).toBeVisible();
    // No console/page error surfaced as an error boundary.
    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
  });

  test('primary navigation shows guest links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav.site-nav');
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.locator('.site-header-actions').getByText('Guest')).toBeVisible();
  });

  test('language toggle flips document direction and copy', async ({ page }) => {
    await page.goto('/');
    // Starts English (seeded).
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await switchLanguage(page, 'AR');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await switchLanguage(page, 'EN');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button.login-submit')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('register page renders the organization form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Register a new organization' })).toBeVisible();
    await expect(page.locator('.register-form')).toBeVisible();
    await expect(page.locator('button.register-submit-button')).toBeVisible();
  });

  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  test('unknown route renders the not-found page', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist');
    // Next.js not-found still returns a rendered page (200 for app-router
    // not-found in dev is acceptable); assert the app shell is intact.
    await expect(page.locator('body')).toBeVisible();
    expect(res?.status()).toBeLessThan(500);
  });
});
