import { Page, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

export const URLS = {
  pos:       'http://localhost:5173',
  dashboard: 'http://localhost:5174',
  docs:      'http://localhost:5180',
  api:       'http://localhost:8080/api',
}

export const SEED = {
  superAdmin:   { email: 'admin@josbin-pos.sr',     password: 'JosbinPOS@2026!' },
  orgAdmin:     { email: 'orgadmin@dehoop.sr',      password: 'OrgAdmin@2026'  },
  storeManager: { email: 'manager@dehoop.sr',       password: 'Manager@2026'   },
  cashier:      { email: 'kassa@dehoop.sr',         password: 'Cashier@2026'   },
}

/**
 * Save a screenshot under <manual>/screenshots/<name>.png.
 * Files land in the repo so VitePress + manual readers see them.
 */
export async function shoot(page: Page, manual: 'user_manual' | 'dashboard_manual' | 'trainer_cheatsheets' | 'docs', name: string) {
  const dir = path.join(REPO_ROOT, manual, 'screenshots')
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: false,
    animations: 'disabled',
  })
}

/** Wait briefly then a stable frame — keeps screenshots crisp + identical between runs. */
export async function settle(page: Page, ms = 400) {
  await page.waitForLoadState('networkidle').catch(() => { /* tolerate hot-reload websocket */ })
  await page.waitForTimeout(ms)
}

/** Click some-text-on-the-page tolerant of slight layout shifts. */
export async function clickText(page: Page, text: string | RegExp) {
  await page.getByText(text, { exact: false }).first().click()
}

/** Type into a labelled / placeholder'd input, with type-based fallback. */
export async function fill(page: Page, labelOrPlaceholder: string | RegExp, value: string) {
  // Try label, placeholder, role with name.
  const candidates = [
    page.getByLabel(labelOrPlaceholder, { exact: false }),
    page.getByPlaceholder(labelOrPlaceholder),
    page.getByRole('textbox', { name: labelOrPlaceholder }),
  ]
  for (const c of candidates) {
    if (await c.first().isVisible().catch(() => false)) {
      await c.first().fill(value)
      return
    }
  }
  // Fallback: type-based locator for the common email/password case.
  const lower = (labelOrPlaceholder instanceof RegExp ? labelOrPlaceholder.source : labelOrPlaceholder).toLowerCase()
  if (lower.includes('mail')) {
    const el = page.locator('input[type="email"]').first()
    if (await el.isVisible().catch(() => false)) { await el.fill(value); return }
  }
  if (lower.includes('wachtwoord') || lower.includes('password')) {
    const el = page.locator('input[type="password"]').first()
    if (await el.isVisible().catch(() => false)) { await el.fill(value); return }
  }
  throw new Error(`Could not find input for: ${labelOrPlaceholder}`)
}

/** Convenience for the most common pattern: cashier/manager/admin login. */
export async function loginAs(page: Page, baseUrl: string, creds: { email: string; password: string }) {
  await page.goto(baseUrl)
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 })
  await page.locator('input[type="email"]').first().fill(creds.email)
  await page.locator('input[type="password"]').first().fill(creds.password)
  await page.getByRole('button', { name: /inloggen|log in|login/i }).first().click()
}
