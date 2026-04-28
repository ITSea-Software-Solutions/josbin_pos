import { test, expect } from '@playwright/test';
import { loginAsCashier, loginAsManager, POS_URL, DASHBOARD_URL } from '../helpers/auth';

/**
 * Z-Report / End of Day flow.
 *
 * Tests:
 *   - Manager can open Z-Report screen
 *   - X-Report (mid-day snapshot) is visible without closing
 *   - Cash reconciliation form works
 *   - Z-Report can be submitted to HQ
 *   - Dashboard shows the submitted Z-Report
 */
test.describe('Z-Report — end of day', () => {

  test('manager can view X-Report without closing', async ({ page }) => {
    await loginAsCashier(page); // manager logs in as cashier on POS

    await page.getByRole('button', { name: /rapporten|reports/i }).click();
    await page.getByRole('button', { name: /x-rapport|x-report/i }).click();

    await expect(page.getByTestId('x-report-view')).toBeVisible();
    await expect(page.getByTestId('x-report-total')).toContainText('SRD');
    // X-report must NOT show "dagafsluiting" / "register closed" language
    await expect(page.getByText(/register gesloten|register closed/i)).not.toBeVisible();
  });

  test('Z-Report shows cash reconciliation form', async ({ page }) => {
    await loginAsCashier(page);

    await page.getByRole('button', { name: /rapporten|reports/i }).click();
    await page.getByRole('button', { name: /z-rapport|z-report/i }).click();

    await expect(page.getByTestId('z-report-view')).toBeVisible();
    await expect(page.getByTestId('cash-counted-input')).toBeVisible();
  });

  test('cash discrepancy is flagged red and requires a note', async ({ page }) => {
    await loginAsCashier(page);

    await page.getByRole('button', { name: /rapporten|reports/i }).click();
    await page.getByRole('button', { name: /z-rapport|z-report/i }).click();

    // Enter a cash amount that differs from the system total
    await page.getByTestId('cash-counted-input').fill('0.01');
    await page.getByTestId('cash-counted-input').press('Tab');

    // Discrepancy badge should appear in red
    await expect(page.getByTestId('cash-discrepancy')).toBeVisible();
    await expect(page.getByTestId('cash-discrepancy')).toHaveCSS('color', /red|#/);

    // Note field must be required when discrepancy exists
    await page.getByRole('button', { name: /afsluiten|close register/i }).click();
    await expect(page.getByTestId('discrepancy-note-error')).toBeVisible();
  });

  test('Z-Report can be submitted to headquarters', async ({ page }) => {
    await loginAsCashier(page);

    await page.getByRole('button', { name: /rapporten|reports/i }).click();
    await page.getByRole('button', { name: /z-rapport|z-report/i }).click();

    // Enter correct cash amount (use system expected value)
    const expected = page.getByTestId('cash-expected-amount');
    const expectedText = await expected.textContent();
    const amount = expectedText?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0';

    await page.getByTestId('cash-counted-input').fill(amount);

    // Close the day
    await page.getByRole('button', { name: /afsluiten|close register/i }).click();
    await page.getByRole('button', { name: /bevestigen|confirm/i }).click();

    // Success: Z-report appears in history table
    await expect(page.getByTestId('z-report-history-row').first()).toBeVisible();

    // Submit to HQ
    await page.getByRole('button', { name: /sturen naar hoofdkantoor|submit to hq/i }).click();
    await page.getByRole('button', { name: /bevestigen|confirm/i }).click();

    await expect(page.getByTestId('sync-status')).toContainText(/verzonden|sent/i);
  });
});

test.describe('Dashboard — Z-Report visibility', () => {

  test('submitted Z-Report appears in dashboard Z-report list', async ({ page }) => {
    await loginAsManager(page);

    // Navigate to Z-Reports section
    await page.getByRole('button', { name: /z-rapporten|z-reports/i }).click();

    await expect(page.getByTestId('z-report-table')).toBeVisible();
    // At least one row should exist (created by the previous test or seeds)
    await expect(page.getByTestId('z-report-row')).toHaveCount({ minimum: 1 } as any);
  });
});
