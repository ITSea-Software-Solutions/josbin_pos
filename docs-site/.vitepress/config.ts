import { defineConfig } from 'vitepress'

/**
 * VitePress config for the Josbin POS documentation site.
 *
 * srcDir is the repo root so the same markdown files in /docs and /user_manual
 * are rendered without being moved or duplicated. Anything outside those two
 * folders is excluded so we don't accidentally render BUILD_STATUS.md, vendor
 * READMEs, etc.
 *
 * Dev:    cd docs-site && npm run dev     → http://localhost:5175
 * Build:  cd docs-site && npm run build   → docs-site/.vitepress/dist/  (static HTML)
 */
export default defineConfig({
  // srcDir points at the repo root so the canonical /docs and /user_manual
  // markdown files render here without being moved or duplicated.
  srcDir: '..',
  outDir: '.vitepress/dist',
  cleanUrls: true,
  lastUpdated: true,

  // Some sidebar entries point to chapters not yet written. They get a 404
  // page until the chapter lands. Once all chapters exist this can be set
  // back to false (or removed) for strict link checking.
  ignoreDeadLinks: true,

  // /docs, /user_manual, and /dashboard_manual carry GitHub-style README.md
  // as their index. Map those so folder URLs resolve to the README contents
  // without renaming files.
  rewrites: {
    'docs/README.md':              'docs/index.md',
    'user_manual/README.md':       'user_manual/index.md',
    'dashboard_manual/README.md':  'dashboard_manual/index.md',
  },

  title: 'Josbin POS',
  description: 'Developer documentation and user manual for Josbin POS — Suriname enterprise POS platform.',

  // Only render markdown from /docs/ and /user_manual/. Everything else is ignored.
  srcExclude: [
    '**/node_modules/**',
    '**/vendor/**',
    '**/storage/**',
    '**/backend/**',
    '**/frontend/**',
    '**/dashboard/**',
    '**/license-server/**',
    '**/scripts/**',
    '**/docker/**',
    '**/progress/**',
    '**/docs-site/node_modules/**',
    'README.md',
    'BUILD_STATUS.md',
    'CLAUDE.md',
    'Phase1&2 Tickets',
    'Phase3&4 Tickets',
  ],

  themeConfig: {
    siteTitle: 'Josbin POS',

    nav: [
      { text: 'Home',            link: '/docs-site/' },
      { text: 'Developer Docs',  link: '/docs/' },
      { text: 'User Manual',     link: '/user_manual/' },
      { text: 'Dashboard Manual',link: '/dashboard_manual/' },
    ],

    sidebar: {
      // ── Developer Documentation ────────────────────────────────────────────
      '/docs/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Overview',                    link: '/docs/' },
            { text: '0. Installation & Setup',     link: '/docs/00-installation-and-setup' },
            { text: '1. Architecture overview',    link: '/docs/01-architecture' },
          ],
        },
        {
          text: 'In Depth (coming soon)',
          collapsed: false,
          items: [
            { text: '2. Data model',               link: '/docs/02-data-model' },
            { text: '3. Auth & roles',             link: '/docs/03-auth-and-roles' },
            { text: '4. Sale lifecycle',           link: '/docs/04-sale-lifecycle' },
            { text: '5. BTW pipeline',             link: '/docs/05-btw-pipeline' },
            { text: '6. Register & Z-Report',      link: '/docs/06-register-and-z-report' },
            { text: '7. Sync & offline',           link: '/docs/07-sync-and-offline' },
            { text: '8. Integration API',          link: '/docs/08-integration-api' },
            { text: '9. Realtime broadcasts',      link: '/docs/09-realtime-broadcasts' },
            { text: '10. Jobs & schedules',        link: '/docs/10-jobs-and-schedules' },
            { text: '11. License & delivery',      link: '/docs/11-license-and-delivery' },
            { text: '12. Code map',                link: '/docs/12-code-map' },
            { text: '13. Dev workflow',            link: '/docs/13-dev-workflow' },
          ],
        },
      ],

      // ── User Manual (POS, cashiers + store managers) ────────────────────────
      '/user_manual/': [
        {
          text: 'POS User Manual',
          collapsed: false,
          items: [
            { text: 'Overview',                       link: '/user_manual/' },
            { text: '1. Getting started — login',     link: '/user_manual/01-getting-started' },
            { text: '2. Daily setup — exchange rate', link: '/user_manual/02-daily-setup' },
            { text: '3. Your register',               link: '/user_manual/03-register' },
            { text: '4. Making a sale',               link: '/user_manual/04-making-a-sale' },
            { text: '5. Taking payment',              link: '/user_manual/05-payment' },
            { text: '6. Receipts',                    link: '/user_manual/06-receipts' },
            { text: '7. Customers',                   link: '/user_manual/07-customers' },
            { text: '8. Discounts',                   link: '/user_manual/08-discounts' },
            { text: '9. Hold bills',                  link: '/user_manual/09-hold-bills' },
            { text: '10. End of day — Z-Report',      link: '/user_manual/10-end-of-day' },
            { text: '11. Reports',                    link: '/user_manual/11-reports' },
            { text: '12. Barcode & label printing',   link: '/user_manual/12-barcode-labels' },
            { text: '13. Settings',                   link: '/user_manual/13-settings' },
          ],
        },
      ],

      // ── Dashboard Manual (HQ — org admin, store manager, super admin) ──────
      '/dashboard_manual/': [
        {
          text: 'Dashboard Manual',
          collapsed: false,
          items: [
            { text: 'Overview',                      link: '/dashboard_manual/' },
            { text: '1. Roles & permissions',        link: '/dashboard_manual/01-roles-and-permissions' },
            // 2-18 added as chapters land
          ],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
          modal: {
            displayDetails: 'Display detailed list',
            resetButtonTitle: 'Reset search',
            backButtonTitle: 'Close',
            noResultsText: 'No results',
            footer: {
              selectText: 'to select',
              navigateText: 'to navigate',
              closeText: 'to close',
            },
          },
        },
      },
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/' },
    ],

    footer: {
      message: 'Josbin POS — Enterprise POS platform for Suriname',
      copyright: 'Internal documentation. Not for redistribution.',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },

    editLink: {
      pattern: ({ filePath }) => `vscode://file${filePath}`,
      text: 'Open in editor',
    },
  },
})
