import { defineConfig, devices } from '@playwright/test';

/**
 * Josbin POS Playwright E2E Configuration
 *
 * Tests the golden path through the entire system:
 *   Login → Store select → POS sale → Receipt → Z-report
 *
 * Run:
 *   npx playwright test                      # all tests
 *   npx playwright test --headed             # visible browser
 *   npx playwright test pos_sale             # single suite
 *   npx playwright show-report               # HTML report
 *
 * Environment variables:
 *   DASHBOARD_URL  — URL of the dashboard app (default: http://localhost:5174)
 *   POS_URL        — URL of the POS Electron app dev server (default: http://localhost:5173)
 *   TEST_EMAIL     — Manager account (default: e2e_manager@josbin_pos.test)
 *   TEST_PASSWORD  — Manager password (default: E2ETest123!)
 *   CASHIER_EMAIL  — Cashier account (default: e2e_cashier@josbin_pos.test)
 *   CASHIER_PASS   — Cashier password (default: E2ETest123!)
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL:       process.env.POS_URL       || 'http://localhost:5173',
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    trace:         'retain-on-failure',
    locale:        'nl-SR',
    timezoneId:    'America/Paramaribo',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
