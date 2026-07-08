import { test, expect } from '@playwright/test';
import { useEnglish } from './helpers';

test.describe('RTL / Arabic (default)', () => {
  test('defaults to Arabic RTL for a first-time visitor', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    // Arabic hero copy is present.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('قيّم');
  });

  test('skip-link and main landmark exist for keyboard/a11y', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toBeVisible();
  });
});

test.describe('Responsive (mobile)', () => {
  // Viewport/touch only — spreading a full device preset sets defaultBrowserType,
  // which Playwright forbids inside a describe block.
  test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  test('mobile nav collapses behind a toggle and opens', async ({ page, context }) => {
    await useEnglish(context);
    await page.goto('/');
    const toggle = page.locator('.site-header-menu-toggle');
    await expect(toggle).toBeVisible();

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // A nav link is reachable once the menu is open.
    await expect(page.locator('nav.site-nav').getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('home page has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    // Allow a 1px rounding tolerance.
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
