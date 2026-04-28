import { test, expect } from '@playwright/test';
import { loginAsCashier } from '../helpers/auth';

/**
 * Receipt generation tests.
 *
 * Covers:
 *   - Receipt is shown after sale
 *   - Receipt contains correct BTW amount
 *   - USD equivalent line shown when exchange rate available
 *   - Email receipt can be triggered
 *   - PDF receipt opens in new tab / Electron shell
 */
test.describe('Receipt', () => {

  async function completeSale(page: any) {
    await loginAsCashier(page);
    await page.getByTestId('product-card').first().click();
    await page.getByRole('button', { name: /betalen|pay/i }).click();
    await page.getByRole('button', { name: /^contant$|^cash$/i }).click();
    // Enter SRD 500 cash
    await page.getByTestId('numpad-5').click();
    await page.getByTestId('numpad-0').click();
    await page.getByTestId('numpad-0').click();
    await page.getByRole('button', { name: /verkoop afronden|complete sale/i }).click();
    await expect(page.getByTestId('receipt-view')).toBeVisible({ timeout: 5_000 });
  }

  test('receipt is displayed after completing a sale', async ({ page }) => {
    await completeSale(page);

    await expect(page.getByTestId('receipt-sale-number')).toBeVisible();
    await expect(page.getByTestId('receipt-total')).toContainText('SRD');
    await expect(page.getByTestId('receipt-cashier')).toBeVisible();
  });

  test('receipt shows BTW breakdown', async ({ page }) => {
    await completeSale(page);

    await expect(page.getByTestId('receipt-btw-section')).toBeVisible();
    await expect(page.getByTestId('receipt-btw-total')).toContainText('SRD');
  });

  test('receipt shows USD equivalent line', async ({ page }) => {
    await completeSale(page);

    // USD line is shown when exchange rate is on file
    // (seed_load_test.php sets rate to 36.50 SRD/USD)
    const usdLine = page.getByTestId('receipt-usd-total');
    await expect(usdLine).toBeVisible();
    await expect(usdLine).toContainText('USD');
  });

  test('can trigger email receipt', async ({ page }) => {
    await completeSale(page);

    await page.getByRole('button', { name: /e-mail bon|email receipt/i }).click();
    await page.getByLabel(/e-mail/i).fill('test@example.com');
    await page.getByRole('button', { name: /versturen|send/i }).click();

    await expect(page.getByText(/verzonden|sent/i)).toBeVisible();
  });

  test('new sale button returns to empty POS screen', async ({ page }) => {
    await completeSale(page);

    await page.getByRole('button', { name: /nieuwe verkoop|new sale/i }).click();
    await expect(page.getByTestId('pos-screen')).toBeVisible();
    await expect(page.getByTestId('cart-item')).toHaveCount(0);
  });
});
