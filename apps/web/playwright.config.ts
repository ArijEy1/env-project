import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const WEB_PORT = 3000;
const API_PORT = 4000;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

/**
 * E2E config. Runs the suite against locally-started API + web dev servers
 * (reusing already-running ones in local dev). The API is booted with the
 * dev-only OTP test seam enabled and SMTP disabled so no real emails are sent.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial: the suite shares one Postgres and creates users; parallel workers
  // would collide on unique emails/CR numbers and trip per-IP rate limits.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // CI uses `next dev` with a cold cache, so the first hit to each route pays a
  // compile cost — give tests more headroom there.
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 10_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: path.resolve(__dirname, '../api'),
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // dotenv in the API does NOT override already-set vars, so SMTP_HOST=''
      // here wins over the .env value and keeps email sends off during tests.
      env: {
        PORT: String(API_PORT),
        NODE_ENV: 'development',
        E2E_TEST_MODE: 'true',
        SMTP_HOST: '',
      },
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: `${API_URL}/api` },
    },
  ],
});
