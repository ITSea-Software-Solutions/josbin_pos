import { defineConfig } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

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

  // Base path for assets — read from BASE_PATH env var so the same config
  // builds for any deploy target. Default '/' for local dev / preview.
  //
  // Examples:
  //   BASE_PATH=/josbin-docs/ npm run build   → itsea.com/josbin-docs/
  //   BASE_PATH=/            npm run build    → docs.itsea.com root
  //   (default)              npm run dev      → localhost
  //
  // The trailing slash matters — VitePress treats `/josbin-docs` and
  // `/josbin-docs/` differently for asset URL rewrites.
  base: process.env.BASE_PATH || '/',

  // Some sidebar entries point to chapters not yet written. They get a 404
  // page until the chapter lands. Once all chapters exist this can be set
  // back to false (or removed) for strict link checking.
  ignoreDeadLinks: true,

  // /docs, /user_manual, /dashboard_manual, /trainer_cheatsheets carry
  // GitHub-style README.md as their index. Map those so folder URLs resolve
  // to the README contents without renaming files.
  rewrites: {
    // Site home — docs-site/index.md lives in the VitePress folder for
    // ergonomic editing, but in the build it has to land at the root so
    // /josbin-docs/ (or whatever the deploy URL is) resolves to the home
    // page instead of 404'ing into /docs-site/.
    'docs-site/index.md':             'index.md',
    // Section index rewrites — each manual carries its README.md as the
    // entry page so folder URLs resolve to the README contents.
    'docs/README.md':                 'docs/index.md',
    'user_manual/README.md':          'user_manual/index.md',
    'dashboard_manual/README.md':     'dashboard_manual/index.md',
    'trainer_cheatsheets/README.md':  'trainer_cheatsheets/index.md',
    // Dutch mirrors
    'nl/docs/README.md':                'nl/docs/index.md',
    'nl/user_manual/README.md':         'nl/user_manual/index.md',
    'nl/dashboard_manual/README.md':    'nl/dashboard_manual/index.md',
    'nl/trainer_cheatsheets/README.md': 'nl/trainer_cheatsheets/index.md',
  },

  title: 'Josbin POS',
  description: 'Developer documentation and user manual for Josbin POS — Suriname enterprise POS platform.',

  // ── Locales (English default, Dutch mirror under /nl/) ────────────────────
  //
  // The English files live at the canonical paths (/user_manual/*, etc.).
  // The Dutch mirror lives under /nl/ — same chapter numbering, same file
  // names, translated content. The navbar gets an EN/NL switcher that
  // jumps to the equivalent NL page automatically.
  //
  // Adding a third locale (Sranantongo, …) only requires another sibling
  // directory + a new locale entry below — no chapter restructuring needed.
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
    },
    nl: {
      label: 'Nederlands',
      lang: 'nl-NL',
      link: '/nl/',
      themeConfig: {
        nav: [
          { text: 'Home',              link: '/nl/' },
          { text: 'Architectuur',      link: '/architecture.html', target: '_blank' },
          { text: 'Ontwikkelaarsdocs', link: '/nl/docs/' },
          { text: 'Handleiding POS',   link: '/nl/user_manual/' },
          { text: 'Handleiding Dashboard', link: '/nl/dashboard_manual/' },
          { text: 'Trainersbladen',    link: '/nl/trainer_cheatsheets/' },
        ],
        sidebar: {
          '/nl/docs/': [
            {
              text: 'Aan de slag',
              collapsed: false,
              items: [
                { text: 'Overzicht',                       link: '/nl/docs/' },
                { text: '0. Installatie & setup',          link: '/nl/docs/00-installation-and-setup' },
                { text: '1. Architectuuroverzicht',        link: '/nl/docs/01-architecture' },
              ],
            },
            {
              text: 'Verdiepende hoofdstukken',
              collapsed: false,
              items: [
                { text: '2. Datamodel',                    link: '/nl/docs/02-data-model' },
                { text: '3. Auth & rollen',                link: '/nl/docs/03-auth-and-roles' },
                { text: '4. Verkooplevenscyclus',          link: '/nl/docs/04-sale-lifecycle' },
                { text: '5. BTW-pipeline',                 link: '/nl/docs/05-btw-pipeline' },
                { text: '6. Kassa & Z-Rapport',            link: '/nl/docs/06-register-and-z-report' },
                { text: '7. Synchronisatie & offline',     link: '/nl/docs/07-sync-and-offline' },
                { text: '8. Integratie-API',               link: '/nl/docs/08-integration-api' },
                { text: '9. Realtime broadcasts',          link: '/nl/docs/09-realtime-broadcasts' },
                { text: '10. Jobs & schema',               link: '/nl/docs/10-jobs-and-schedules' },
                { text: '11. Licentie & oplevering',       link: '/nl/docs/11-license-and-delivery' },
                { text: '12. Code-overzicht',              link: '/nl/docs/12-code-map' },
                { text: '13. Apps bouwen & uitbrengen',     link: '/nl/docs/13-dev-workflow' },
                { text: '14. Uitroldraaiboek klantlocaties', link: '/nl/docs/14-client-deployment-playbook' },
                { text: '15. Android-kassaterminals', link: '/nl/docs/15-android-terminals' },
                { text: '16. De vier opstellingen', link: '/nl/docs/16-deployment-options' },
                { text: '17. Releasenotities', link: '/nl/docs/17-release-notes' },
                { text: '18. Testplan', link: '/nl/docs/18-test-plan' },
                { text: 'QR-wallet betalingen (flow & use cases)', link: '/nl/docs/qr-payment-flow' },
                { text: 'Systeemflows (end-to-end diagrammen)', link: '/nl/docs/system-flows' },
              ],
            },
          ],
          '/nl/user_manual/': [
            {
              text: 'POS-handleiding',
              collapsed: false,
              items: [
                { text: 'Overzicht',                                  link: '/nl/user_manual/' },
                { text: '1. Aan de slag — inloggen',                  link: '/nl/user_manual/01-getting-started' },
                { text: '2. Dagelijkse setup — wisselkoers',          link: '/nl/user_manual/02-daily-setup' },
                { text: '3. Uw kassa',                                link: '/nl/user_manual/03-register' },
                { text: '4. Een verkoop maken',                       link: '/nl/user_manual/04-making-a-sale' },
                { text: '5. Betaling aannemen',                       link: '/nl/user_manual/05-payment' },
                { text: '5a. Terugbetalingen & annuleringen',         link: '/nl/user_manual/05a-refunds-and-voids' },
                { text: '6. Bonnen',                                  link: '/nl/user_manual/06-receipts' },
                { text: '7. Klanten',                                 link: '/nl/user_manual/07-customers' },
                { text: '8. Kortingen',                               link: '/nl/user_manual/08-discounts' },
                { text: '9. Vastgehouden bonnen',                     link: '/nl/user_manual/09-hold-bills' },
                { text: '10. Einde dag — Z-Rapport',                  link: '/nl/user_manual/10-end-of-day' },
                { text: '11. Rapporten',                              link: '/nl/user_manual/11-reports' },
                { text: '12. Barcode & label printen',                link: '/nl/user_manual/12-barcode-labels' },
                { text: '13. Instellingen',                           link: '/nl/user_manual/13-settings' },
              ],
            },
          ],
          '/nl/dashboard_manual/': [
            {
              text: 'Dashboard-handleiding',
              collapsed: false,
              items: [
                { text: 'Overzicht',                                     link: '/nl/dashboard_manual/' },
                { text: '1. Rollen & rechten',                           link: '/nl/dashboard_manual/01-roles-and-permissions' },
                { text: '2. Organisatie & vestiging opzetten',           link: '/nl/dashboard_manual/02-organisation-and-store-setup' },
                { text: '3. Gebruikers',                                 link: '/nl/dashboard_manual/03-users' },
                { text: '4. Catalogus & categorieën',                    link: '/nl/dashboard_manual/04-catalogue-and-categories' },
                { text: '5. Bulkimport (CSV / Excel)',                   link: '/nl/dashboard_manual/05-bulk-import-csv-excel' },
                { text: '6. Prijzen & vestigingsspecifieke overschrijvingen', link: '/nl/dashboard_manual/06-pricing-and-per-store-overrides' },
                { text: '7. Kortingsregels',                             link: '/nl/dashboard_manual/07-discount-rules' },
                { text: '8. Voorraadbeheer',                             link: '/nl/dashboard_manual/08-stock-management' },
                { text: '9. Klanten',                                    link: '/nl/dashboard_manual/09-customers' },
                { text: '10. Rapporten — dagelijks, maandelijks, BTW, Rekenkamer', link: '/nl/dashboard_manual/10-reports' },
                { text: '11. Z-Rapporten & einde-dag synchronisatie',    link: '/nl/dashboard_manual/11-z-reports-and-end-of-day-sync' },
                { text: '12. API-integraties & webhooks',                link: '/nl/dashboard_manual/12-api-integrations-and-webhooks' },
                { text: '13. Auditlogboek',                              link: '/nl/dashboard_manual/13-audit-log' },
                { text: '14. AI-inzichten',                              link: '/nl/dashboard_manual/14-ai-insights' },
                { text: '15. Licentiebeheer — UI-overzicht',             link: '/nl/dashboard_manual/15-license-management' },
                { text: '16. Licentieoperaties',                         link: '/nl/dashboard_manual/16-license-operations' },
                { text: '17. Beveiligingsbeleid (2FA per rol)',          link: '/nl/dashboard_manual/17-security-policy' },
                { text: '18. Mijn Profiel',                              link: '/nl/dashboard_manual/18-my-account' },
                { text: '19. Kassabeheer',                               link: '/nl/dashboard_manual/19-registers' },
                { text: '20. BTW-aangiftes (Belastingdienst)',           link: '/nl/dashboard_manual/20-btw-submissions-belastingdienst' },
                { text: '21. Belastinginspecteur',                       link: '/nl/dashboard_manual/21-tax-inspector' },
                { text: '22. Betaalmethoden, QR-wallets & openstaande betalingen', link: '/nl/dashboard_manual/22-payment-methods-and-wallets' },
              ],
            },
          ],
          '/nl/trainer_cheatsheets/': [
            {
              text: 'Trainersbladen',
              collapsed: false,
              items: [
                { text: 'Overzicht',                          link: '/nl/trainer_cheatsheets/' },
                { text: '1. Kassier — dagelijkse workflow',   link: '/nl/trainer_cheatsheets/01-cashier-daily' },
                { text: '2. Manager — Z-Rapport',             link: '/nl/trainer_cheatsheets/02-manager-z-report' },
                { text: '3. Dashboard-overzicht',             link: '/nl/trainer_cheatsheets/03-dashboard-overview' },
              ],
            },
          ],
        },
        footer: {
          message: 'Josbin POS — POS-platform voor Suriname',
          copyright: 'Interne documentatie. Niet voor verspreiding.',
        },
        outline: { level: [2, 3], label: 'Op deze pagina' },
        editLink: {
          pattern: ({ filePath }) => `vscode://file${filePath}`,
          text: 'Open in editor',
        },
      },
    },
  },

  // VitePress dev server intercepts every *.html request with the SPA shell
  // (the `public/` static-fallthrough only fires during a production build).
  // Register a tiny middleware so /architecture.html serves the real file in
  // dev. Doesn't run in `vitepress build` — there the file is just copied
  // verbatim out of `public/` into `dist/` as a static asset.
  vite: {
    // srcDir is the repo root, so during build Rollup walks up from each
    // markdown file looking for node_modules — and finds nothing, because
    // vue + vitepress live ONLY under docs-site/node_modules. Pin absolute
    // resolutions for the imports VitePress injects into compiled markdown
    // SFCs (vue + vue/server-renderer) so Rollup can find them no matter
    // where the source markdown file lives.
    resolve: {
      alias: [
        {
          find: /^vue\/server-renderer$/,
          replacement: resolve(__dirname, '..', 'node_modules/vue/server-renderer/index.mjs'),
        },
        {
          find: /^vue$/,
          replacement: resolve(__dirname, '..', 'node_modules/vue/dist/vue.runtime.esm-bundler.js'),
        },
      ],
    },
    plugins: [{
      name: 'josbin-serve-static-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next()
          // Strip query string before extension test.
          const path = req.url.split('?')[0]
          if (!path.endsWith('.html') || path === '/index.html') return next()
          // Resolve relative to docs-site/public.
          const file = resolve(__dirname, '..', 'public', path.replace(/^\//, ''))
          if (!existsSync(file)) return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(readFileSync(file))
        })
      },
    }],
  },

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
    // NOTE: docs-site/index.md is the site HOMEPAGE (rewritten to root index)
    // — never exclude docs-site/** wholesale or the homepage disappears.
    'docs-site/README.md', // the site's own README must not render into itself
    '**/marketing/**',     // marketing/* lives outside the docs site
    'nl/marketing/**',     // ditto for the NL mirror
    'README.md',
    'BUILD_STATUS.md',
    'CLAUDE.md',
    'CLAUDE_WORKING_GUIDE.md',
    'FEATURES_AND_FLOWS.md',
    'HANDOVER.md',
    'PENDING.md',
    'FIELD_RUNBOOK.md',
    'OPS_CHEATSHEET.md',
    'PARTNER_OUTREACH.md',
    'legal/**',
    'AUDIT_FINDINGS*.md',
    '.claude/**',
    'Phase1&2 Tickets/**',
    'Phase3&4 Tickets/**',
    'Phase1&2 Tickets',
    'Phase3&4 Tickets',
  ],

  themeConfig: {
    siteTitle: 'Josbin POS',

    nav: [
      { text: 'Home',            link: '/' },
      { text: 'Architecture',    link: '/architecture.html', target: '_blank' },
      { text: 'Developer Docs',  link: '/docs/' },
      { text: 'User Manual',     link: '/user_manual/' },
      { text: 'Dashboard Manual',link: '/dashboard_manual/' },
      { text: 'Trainer Sheets',  link: '/trainer_cheatsheets/' },
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
            { text: '13. Building & releasing the apps', link: '/docs/13-dev-workflow' },
                { text: '14. Client deployment playbook', link: '/docs/14-client-deployment-playbook' },
                { text: '15. Android terminals', link: '/docs/15-android-terminals' },
                { text: '16. The four setups', link: '/docs/16-deployment-options' },
                { text: '17. Release notes', link: '/docs/17-release-notes' },
                { text: '18. Test plan', link: '/docs/18-test-plan' },
                { text: 'QR-wallet betalingen (flow & use cases)', link: '/docs/qr-payment-flow' },
                { text: 'System flows (end-to-end diagrams)', link: '/docs/system-flows' },
                { text: 'System flow map (plain language)',   link: '/docs/FLOWS' },
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
            { text: '5a. Refunds & voids',            link: '/user_manual/05a-refunds-and-voids' },
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
            { text: '2. Organisation & store setup', link: '/dashboard_manual/02-organisation-and-store-setup' },
            { text: '3. Users — create/edit/deactivate', link: '/dashboard_manual/03-users' },
            { text: '4. Catalogue & categories',     link: '/dashboard_manual/04-catalogue-and-categories' },
            { text: '5. Bulk import (CSV / Excel)',  link: '/dashboard_manual/05-bulk-import-csv-excel' },
            { text: '6. Pricing & per-store overrides', link: '/dashboard_manual/06-pricing-and-per-store-overrides' },
            { text: '7. Discount rules',             link: '/dashboard_manual/07-discount-rules' },
            { text: '8. Stock management',           link: '/dashboard_manual/08-stock-management' },
            { text: '9. Customers',                  link: '/dashboard_manual/09-customers' },
            { text: '10. Reports — daily, monthly, BTW, Rekenkamer', link: '/dashboard_manual/10-reports' },
            { text: '11. Z-Reports & end-of-day sync', link: '/dashboard_manual/11-z-reports-and-end-of-day-sync' },
            { text: '12. API integrations & webhooks', link: '/dashboard_manual/12-api-integrations-and-webhooks' },
            { text: '13. Audit log',                 link: '/dashboard_manual/13-audit-log' },
            { text: '14. AI insights',               link: '/dashboard_manual/14-ai-insights' },
            { text: '15. License management — UI overview', link: '/dashboard_manual/15-license-management' },
            { text: '16. License operations — sales, install, renew, recover', link: '/dashboard_manual/16-license-operations' },
            { text: '17. Security policy (2FA per role)', link: '/dashboard_manual/17-security-policy' },
            { text: '18. My Account',                link: '/dashboard_manual/18-my-account' },
            { text: '19. Registers & shifts',        link: '/dashboard_manual/19-registers' },
            { text: '20. BTW submissions (Belastingdienst)', link: '/dashboard_manual/20-btw-submissions-belastingdienst' },
            { text: '21. Tax inspector',             link: '/dashboard_manual/21-tax-inspector' },
            { text: '22. Payment methods, QR wallets & pending payments', link: '/dashboard_manual/22-payment-methods-and-wallets' },
          ],
        },
      ],

      // ── Trainer Cheat Sheets (one-page printable references) ──────────────
      '/trainer_cheatsheets/': [
        {
          text: 'Trainer Cheat Sheets',
          collapsed: false,
          items: [
            { text: 'Overview',                      link: '/trainer_cheatsheets/' },
            { text: '1. Cashier — daily workflow',   link: '/trainer_cheatsheets/01-cashier-daily' },
            { text: '2. Manager — Z-Report',         link: '/trainer_cheatsheets/02-manager-z-report' },
            { text: '3. Dashboard overview',         link: '/trainer_cheatsheets/03-dashboard-overview' },
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
