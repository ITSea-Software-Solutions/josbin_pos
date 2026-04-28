import { test, expect, Page } from '@playwright/test';
import { loginAsCashier } from '../helpers/auth';

/**
 * Golden path: complete a sale from the POS screen.
 *
 * This test covers the critical transaction path:
 *   1. Add items from product grid
 *   2. Apply a discount
 *   3. Pay by cash
 *   4. Confirm sale total and change
 *   5. Receipt is shown
 */
test.describe('POS Sale — golden path', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('can add a product to cart by clicking', async ({ page }) => {
    const firstProduct = page.getByTestId('product-card').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();

    // Cart should show 1 item
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await expect(page.getByTestId('cart-total')).toContainText('SRD');
  });

  test('can search a product by barcode', async ({ page }) => {
    await page.getByTestId('barcode-input').fill('5901234123457'); // pre-seeded EAN
    await page.getByTestId('barcode-input').press('Enter');

    await expect(page.getByTestId('cart-item')).toHaveCount(1);
  });

  test('can complete a cash sale and see change', async ({ page }) => {
    // Add 2 different products
    const products = page.getByTestId('product-card');
    await products.nth(0).click();
    await products.nth(1).click();

    // Open payment dialog
    await page.getByRole('button', { name: /betalen|pay/i }).click();
    await expect(page.getByTestId('payment-dialog')).toBeVisible();

    // Select cash
    await page.getByRole('button', { name: /^contant$|^cash$/i }).click();

    // Enter cash amount (SRD 200 should be more than enough)
    await page.getByTestId('numpad-2').click();
    await page.getByTestId('numpad-0').click();
    await page.getByTestId('numpad-0').click();

    // Should show change
    await expect(page.getByTestId('change-amount')).toBeVisible();

    // Confirm
    await page.getByRole('button', { name: /verkoop afronden|complete sale/i }).click();

    // Receipt should appear
    await expect(page.getByTestId('receipt-view')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('receipt-sale-number')).toBeVisible();
  });

  test('sale includes correct BTW line on receipt', async ({ page }) => {
    await page.getByTestId('product-card').first().click();
    await page.getByRole('button', { name: /betalen|pay/i }).click();
    await page.getByRole('button', { name: /^contant$|^cash$/i }).click();

    // Enter generous cash amount
    for (let i = 0; i < 3; i++) await page.getByTestId('numpad-5').click();

    await page.getByRole('button', { name: /verkoop afronden|complete sale/i }).click();
    await expect(page.getByTestId('receipt-view')).toBeVisible();

    // Receipt must show BTW section
    await expect(page.getByTestId('receipt-btw-total')).toBeVisible();
    await expect(page.getByTestId('receipt-btw-total')).toContainText('SRD');
  });

  test('can apply a line-item discount', async ({ page }) => {
    await page.getByTestId('product-card').first().click();

    // Open line item edit
    await page.getByTestId('cart-item').first().click();
    await page.getByTestId('line-discount-input').fill('10');
    await page.keyboard.press('Enter');

    // Total should reflect the discount
    const discountBadge = page.getByTestId('line-discount-badge');
    await expect(discountBadge).toBeVisible();
  });

  test('can hold a bill and resume it', async ({ page }) => {
    await page.getByTestId('product-card').first().click();

    // Hold the bill
    await page.getByRole('button', { name: /bewaar|hold/i }).click();
    await expect(page.getByTestId('cart-item')).toHaveCount(0); // cart cleared

    // Open held bills
    await page.getByRole('button', { name: /openstaande|held bills/i }).click();
    const heldBill = page.getByTestId('held-bill-item').first();
    await expect(heldBill).toBeVisible();
    await heldBill.click(); // restore

    // Cart should be repopulated
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
  });
});
