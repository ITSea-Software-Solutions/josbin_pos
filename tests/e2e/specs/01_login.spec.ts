import { test, expect } from '@playwright/test';
import { loginAsCashier, loginAsManager, POS_URL, DASHBOARD_URL } from '../helpers/auth';

test.describe('Authentication', () => {

  test('cashier can log in to POS', async ({ page }) => {
    await loginAsCashier(page);
    // POS screen should show the product grid
    await expect(page.getByTestId('product-grid')).toBeVisible();
  });

  test('rejects wrong password', async ({ page }) => {
    await page.goto(POS_URL);
    await page.getByLabel(/e-mail/i).fill('e2e_cashier@josbin_pos.test');
    await page.getByLabel(/wachtwoord|password/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /inloggen|login/i }).click();
    // Should show error, stay on login page
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('pos-screen')).not.toBeVisible();
  });

  test('manager can log in to dashboard', async ({ page }) => {
    await loginAsManager(page);
    await expect(page.getByTestId('dashboard-summary')).toBeVisible();
  });

  test('cashier can log out', async ({ page }) => {
    await loginAsCashier(page);
    await page.getByRole('button', { name: /uitloggen|logout/i }).click();
    await expect(page.getByRole('button', { name: /inloggen|login/i })).toBeVisible();
  });

  test('language toggle switches to English', async ({ page }) => {
    await loginAsCashier(page);
    await page.getByRole('button', { name: /^EN$/i }).click();
    await expect(page.getByText(/total/i)).toBeVisible();
  });
});
