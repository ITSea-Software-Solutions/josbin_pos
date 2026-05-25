import { test } from '@playwright/test'
import { URLS, SEED, shoot, settle, fill } from './helpers'

/**
 * Screenshot capture suite.
 *
 * Each `test` block walks one user-manual flow and saves screenshots at the
 * points referenced by the manual chapter (the chapter has matching ![] markers).
 *
 * Naming: <manual>/screenshots/<two-digit-chapter>-<slug>.png
 *   e.g.  user_manual/screenshots/01-login-screen.png
 *
 * Add a new test when you add a flow. Re-run `npm run capture` to refresh all.
 */

// ─── POS — User Manual flows ──────────────────────────────────────────────────

test('user-manual ch.1 — login + store select', async ({ page }) => {
  await page.goto(URLS.pos)
  await settle(page, 600)
  await shoot(page, 'user_manual', '01-login-screen')

  await fill(page, /e-?mail|email/i, SEED.cashier.email)
  await fill(page, /wachtwoord|password/i, SEED.cashier.password)
  await shoot(page, 'user_manual', '01-login-filled')

  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 800)
  // Store-select screen (only shows when user has access to multiple stores)
  await shoot(page, 'user_manual', '01-store-select')
})

test('user-manual ch.3 — open register', async ({ page }) => {
  await page.goto(URLS.pos)
  await settle(page, 400)
  await fill(page, /e-?mail|email/i, SEED.cashier.email)
  await fill(page, /wachtwoord|password/i, SEED.cashier.password)
  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 1000)

  // Click first store card if we land on store-select
  const storeCard = page.getByRole('button').filter({ hasText: /Hoop|Diago|store/i }).first()
  if (await storeCard.isVisible().catch(() => false)) {
    await storeCard.click()
    await settle(page, 600)
  }

  // Open-register gate — first the register pick step (skipped if only one register)
  await shoot(page, 'user_manual', '03-open-register-gate')

  // If we're on the pick step, click a register
  const registerCard = page.getByText(/kassa\s*1|register\s*1/i).first()
  if (await registerCard.isVisible().catch(() => false)) {
    await registerCard.click()
    await settle(page, 400)
  }

  // Opening-float step
  await shoot(page, 'user_manual', '03-opening-float')
})

test('user-manual ch.4-5 — POS screen + payment', async ({ page }) => {
  await page.goto(URLS.pos)
  await settle(page, 400)
  await fill(page, /e-?mail|email/i, SEED.cashier.email)
  await fill(page, /wachtwoord|password/i, SEED.cashier.password)
  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 2500) // POS resume may be slower (existing session)

  // If we land on store select / open register, navigate through quickly
  const storeBtn = page.getByRole('button').filter({ hasText: /Hoop|Diago|store/i }).first()
  if (await storeBtn.isVisible().catch(() => false)) {
    await storeBtn.click()
    await settle(page, 500)
  }

  // Resume session is automatic; if "Open register" still shows, click through
  const openBtn = page.getByRole('button', { name: /open|kassa openen/i }).first()
  if (await openBtn.isVisible().catch(() => false)) {
    // Pick a register first if needed
    const reg = page.getByText(/kassa\s*1/i).first()
    if (await reg.isVisible().catch(() => false)) {
      await reg.click()
      await settle(page, 300)
    }
    await openBtn.click()
    await settle(page, 800)
  }

  await shoot(page, 'user_manual', '04-pos-screen-empty-cart')

  // Click the first product card in the grid to add to cart
  const firstProduct = page.locator('[data-testid^="product-card"], .product-card, button:has-text("SRD")').first()
  if (await firstProduct.isVisible().catch(() => false)) {
    await firstProduct.click()
    await settle(page, 400)
    await shoot(page, 'user_manual', '04-pos-screen-with-item')
  }
})

// ─── Dashboard — Dashboard Manual flows ───────────────────────────────────────

test('dashboard-manual ch.1 — login + overview', async ({ page }) => {
  await page.goto(URLS.dashboard)
  await settle(page, 600)
  await shoot(page, 'dashboard_manual', '01-login-screen')

  await fill(page, /e-?mail|email/i, SEED.orgAdmin.email)
  await fill(page, /wachtwoord|password/i, SEED.orgAdmin.password)
  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 1500)
  await shoot(page, 'dashboard_manual', '01-overview-landing')
})

test('dashboard-manual ch.3 — users screen', async ({ page }) => {
  await page.goto(URLS.dashboard)
  await settle(page, 400)
  await fill(page, /e-?mail|email/i, SEED.orgAdmin.email)
  await fill(page, /wachtwoord|password/i, SEED.orgAdmin.password)
  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 1500)

  await page.getByRole('button', { name: /gebruikers|users/i }).first().click().catch(() => {})
  await settle(page, 700)
  await shoot(page, 'dashboard_manual', '03-users-list')
})

test('dashboard-manual ch.4 — catalogue', async ({ page }) => {
  await page.goto(URLS.dashboard)
  await settle(page, 400)
  await fill(page, /e-?mail|email/i, SEED.orgAdmin.email)
  await fill(page, /wachtwoord|password/i, SEED.orgAdmin.password)
  await page.getByRole('button', { name: /inloggen|aanmelden|sign[ -]?in|log[ -]?in|login/i }).first().click()
  await settle(page, 1500)

  await page.getByRole('button', { name: /catalogus|catalogue/i }).first().click().catch(() => {})
  await settle(page, 700)
  await shoot(page, 'dashboard_manual', '04-catalogue-list')
})

// ─── Install guide — docs site itself ────────────────────────────────────────

test('install-guide — Swagger UI', async ({ page }) => {
  await page.goto(`${URLS.api.replace('/api', '')}/api/v1/docs`)
  await settle(page, 1500)
  await shoot(page, 'docs', '00-swagger-ui')
})

test('install-guide — docs site landing', async ({ page }) => {
  await page.goto(URLS.docs)
  await settle(page, 800)
  await shoot(page, 'docs', '00-docs-site-landing')
})
