import { test, expect } from '@playwright/test';
import { useEnglish, apiLogin, seedSession, SUPERADMIN } from './helpers';

const ADMIN_PAGES: { path: string; heading: RegExp }[] = [
  { path: '/admin', heading: /Overview/ },
  { path: '/admin/entities', heading: /Entit/ },
  { path: '/admin/assessments', heading: /Assessment/ },
  { path: '/admin/questions', heading: /Question/ },
  { path: '/admin/recommendations', heading: /Recommendation/ },
  { path: '/admin/regulatory', heading: /Regulator/ },
  { path: '/admin/glossary', heading: /Glossar/ },
];

test.describe('Admin panel (superadmin)', () => {
  test.beforeEach(async ({ context, request }) => {
    await useEnglish(context);
    const auth = await apiLogin(request, SUPERADMIN.email, SUPERADMIN.password);
    await seedSession(context, auth);
  });

  test('admin dashboard renders overview stats', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.locator('.admin-stat-card').first()).toBeVisible();
    // Sidebar navigation present.
    await expect(page.locator('.admin-nav')).toBeVisible();
  });

  for (const { path, heading } of ADMIN_PAGES) {
    test(`admin page loads without error: ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} returned ${res?.status()}`).toBeLessThan(400);
      // The admin shell renders and there is no error boundary.
      await expect(page.locator('.admin-layout')).toBeVisible();
      await expect(page.locator('text=Something went wrong')).toHaveCount(0);
      await expect(page.getByRole('heading').filter({ hasText: heading }).first()).toBeVisible();
    });
  }

  test('non-admin is kept out of the admin panel', async ({ page, context }) => {
    // Overwrite the seeded superadmin session with a plain user role.
    await context.addInitScript(() => {
      const u = window.localStorage.getItem('env-project-user');
      if (u) {
        const parsed = JSON.parse(u);
        parsed.role = 'admin';
        window.localStorage.setItem('env-project-user', JSON.stringify(parsed));
      }
    });
    await page.goto('/admin');
    // A plain org admin must not see platform-wide stats — whether the app
    // redirects away or the superadmin-guarded API refuses to load them.
    await expect(page.locator('.admin-stat-card')).toHaveCount(0);
  });
});
