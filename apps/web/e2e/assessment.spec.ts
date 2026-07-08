import { test, expect } from '@playwright/test';
import { useEnglish, seedSession, registerVerifiedUser } from './helpers';

test.describe('Assessment flow', () => {
  test.beforeEach(async ({ context }) => {
    await useEnglish(context);
  });

  test('new user can confirm profile and start an assessment', async ({ page, context, request }) => {
    const auth = await registerVerifiedUser(request, 'Assessor');
    await seedSession(context, auth);

    await page.goto('/assessment/new');
    // Fresh user has no draft → the profile-confirmation card shows.
    await expect(page.getByRole('heading', { name: 'Confirm your profile' })).toBeVisible();
    await expect(page.locator('.profile-confirm-row').first()).toBeVisible();

    await page.getByRole('button', { name: 'Confirm and start' }).click();

    // Redirects to the wizard for the created assessment.
    await page.waitForURL(/\/assessment\/[0-9a-f-]+$/);
    await expect(page.locator('.wizard-question-text, .assessment-wizard, main')).toBeVisible();
  });

  test('account page shows the assessment card and start CTA', async ({ page, context, request }) => {
    const auth = await registerVerifiedUser(request, 'Dashboard');
    await seedSession(context, auth);

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /Welcome, Dashboard/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Environmental Assessment' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start New Assessment' })).toBeVisible();
  });
});
