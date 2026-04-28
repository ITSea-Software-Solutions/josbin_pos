import { Page, expect } from '@playwright/test';

const POS_URL        = process.env.POS_URL        || 'http://localhost:5173';
const DASHBOARD_URL  = process.env.DASHBOARD_URL  || 'http://localhost:5174';
const TEST_EMAIL     = process.env.TEST_EMAIL     || 'e2e_manager@josbin_pos.test';
const TEST_PASSWORD  = process.env.TEST_PASSWORD  || 'E2ETest123!';
const CASHIER_EMAIL  = process.env.CASHIER_EMAIL  || 'e2e_cashier@josbin_pos.test';
const CASHIER_PASS   = process.env.CASHIER_PASS   || 'E2ETest123!';

export { POS_URL, DASHBOARD_URL, TEST_EMAIL, TEST_PASSWORD, CASHIER_EMAIL, CASHIER_PASS };

/**
 * Login as a cashier on the POS app.
 */
export async function loginAsCashier(page: Page): Promise<void> {
  await page.goto(POS_URL);
  await page.getByLabel(/e-mail/i).fill(CASHIER_EMAIL);
  await page.getByLabel(/wachtwoord|password/i).fill(CASHIER_PASS);
  await page.getByRole('button', { name: /inloggen|login/i }).click();
  // Wait for the POS screen to be ready
  await expect(page.getByTestId('pos-screen')).toBeVisible({ timeout: 10_000 });
}

/**
 * Login as a manager on the Dashboard app.
 */
export async function loginAsManager(page: Page): Promise<void> {
  await page.goto(DASHBOARD_URL);
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL);
  await page.getByLabel(/wachtwoord|password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /inloggen|login/i }).click();
  await expect(page.getByTestId('dashboard-layout')).toBeVisible({ timeout: 10_000 });
}
