import { test, expect } from '@playwright/test';
import { loginAsManager, DASHBOARD_URL } from '../helpers/auth';

/**
 * Super Admin Dashboard — overview and navigation tests.
 */
test.describe('Dashboard overview', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test('shows live store overview with SRD totals', async ({ page }) => {
    await expect(page.getByTestId('dashboard-summary')).toBeVisible();
    await expect(page.getByTestId('store-card').first()).toBeVisible();
    // Revenue shown in SRD
    await expect(page.getByTestId('store-card').first()).toContainText('SRD');
  });

  test('can navigate to organisations', async ({ page }) => {
    await page.getByRole('button', { name: /organisaties|organisations/i }).click();
    await expect(page.getByTestId('organisations-table')).toBeVisible();
  });

  test('can navigate to licenses screen', async ({ page }) => {
    await page.getByRole('button', { name: /licenties|licenses/i }).click();
    await expect(page.getByTestId('licenses-table')).toBeVisible();
  });

  test('can navigate to audit log', async ({ page }) => {
    await page.getByRole('button', { name: /audit|auditlog/i }).click();
    await expect(page.getByTestId('audit-log-table')).toBeVisible();
  });

  test('can push catalogue to stores', async ({ page }) => {
    await page.getByRole('button', { name: /organisaties|organisations/i }).click();

    const pushBtn = page.getByRole('button', { name: /catalogus pushen|push catalogue/i }).first();
    await expect(pushBtn).toBeVisible();
    await pushBtn.click();

    // Should transition to 'sending' state
    await expect(page.getByTestId('push-status').first()).toContainText(/versturen|sending/i, { timeout: 3_000 });
  });

  test('language toggle works on dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /^EN$/i }).click();
    await expect(page.getByText(/organisations/i)).toBeVisible();
    await expect(page.getByText(/organisations/i)).not.toContainText('Organisaties');
  });
});
