import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the Josbin POS screenshot capture suite.
 *
 * Goals
 * - Capture clean, deterministic PNG screenshots of every documented user flow
 * - Run against the live dev servers (POS :5173, Dashboard :5174, Docs :5180)
 * - Headless by default; no test report HTML — we want the screenshots, not pass/fail
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false, // sequential — flows depend on a clean known state
  workers: 1,
  retries: 0,
  reporter: [['list']],

  use: {
    headless: true,
    viewport: { width: 1366, height: 820 }, // common POS terminal resolution
    deviceScaleFactor: 2, // crisp on Retina + when printed
    locale: 'nl-NL',
    timezoneId: 'America/Paramaribo',
  },

  projects: [
    { name: 'capture', use: { ...devices['Desktop Chrome'] } },
  ],
})
