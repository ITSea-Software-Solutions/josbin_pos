#!/usr/bin/env node
// =============================================================================
// Josbin POS — build the PASSWORD-PROTECTED internal docs site
//
// Renders the repo's internal/confidential markdown (continuity, pending
// points, engineering guide, audits, research) into a small static site at
// internal-docs-dist/ (gitignored). Served by docs-web nginx at
// /internal/ behind HTTP basic auth — see docker/frontends/docs.conf.
//
//   node scripts/build-internal-docs.mjs      (deploy-server.sh runs it)
//
// These files are all in the VitePress srcExclude list — this builder is the
// ONLY thing that publishes them, and only behind the password.
// =============================================================================
import { marked } from '../docs-site/node_modules/marked/lib/marked.esm.js'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT  = resolve(ROOT, 'internal-docs-dist')
mkdirSync(OUT, { recursive: true })

/** [source, slug, title, one-line description] — hub order. */
const DOCS = [
  ['PENDING.md',                                'pending',          'Pending points & decisions', 'Everything open: waiting-on-you list, prod-split day, dev backlog, decisions'],
  ['HANDOVER.md',                               'handover',         'Handover / continuity map',  'Infra map, access & secret locations, status snapshot, standing rules'],
  ['progress/architecture-review-2026-07.html', 'architecture-review', 'Architecture & excellence review', 'Scorecard, roadmap, spec-conformance ledger, evidence (July 2026)'],
  ['progress/load-test-2026-07.md',             'load-test',        'Load-test results',          'k6 harness design + first-run results and interpretation'],
  ['progress/research-regional-payments-2026-07.md', 'payments-research', 'Regional payments research', 'Verified Suriname/Guyana/T&T/Brazil payment-landscape findings'],
  ['FEATURES_AND_FLOWS.md',                     'features-and-flows', 'Features & flows registry', 'Living feature inventory, user journeys, dated changelog'],
  ['CLAUDE_WORKING_GUIDE.md',                   'working-guide',    'Engineering working guide',  'Discipline, surfaces checklist, gotcha registry, ops practices'],
  ['CLAUDE.md',                                 'product-brief',    'Product brief / master spec', 'The full platform specification the build follows'],
  ['AUDIT_FINDINGS_2026-06-04.md',              'audit-findings',   'Security audit findings (June)', 'The P0/P1 findings list — all since fixed; kept as record'],
  ['BUILD_STATUS.md',                           'build-status',     'Build status (historical)',  'Frozen session-by-session record up to May 2026'],
  ['progress/Week_1.md',                        'week-1',           'Progress — week 1',          'Early build log'],
  ['progress/Week_2.md',                        'week-2',           'Progress — week 2',          'Early build log'],
  ['progress/Week_3.md',                        'week-3',           'Progress — week 3',          'Early build log'],
]

const CSS = `
  :root{--navy:#293371;--orange:#ef6c00;--bg:#f7f8fc;--card:#fff;--ink:#1a2340;--muted:#5d6a8a;--line:#e3e8f4;--mono:#f0f3fa}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,"Segoe UI",system-ui,Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:900px;margin:0 auto;padding:34px 20px 80px}
  .eyebrow{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--orange)}
  h1{color:var(--navy);letter-spacing:-.02em;line-height:1.15;margin:6px 0 14px}
  h2{color:var(--navy);margin-top:34px}h3{color:var(--navy)}
  a{color:var(--navy)}code{background:var(--mono);padding:1px 6px;border-radius:5px;font-size:.9em}
  pre{background:var(--mono);padding:14px 16px;border-radius:10px;overflow-x:auto}
  pre code{background:none;padding:0}
  .tblwrap,table{max-width:100%}.tblwrap{overflow-x:auto}
  table{border-collapse:collapse;font-size:13.5px;width:100%}
  th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;vertical-align:top}
  th{background:var(--mono);font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
  blockquote{border-left:4px solid var(--orange);margin:14px 0;padding:8px 16px;background:var(--card);border-radius:0 10px 10px 0;color:var(--muted)}
  .back{display:inline-block;margin-bottom:14px;font-size:13px;text-decoration:none;font-weight:700}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px;display:block;text-decoration:none;transition:border-color .15s}
  .card:hover{border-color:var(--navy)}
  .card b{color:var(--navy);font-size:15.5px}.card span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
  .warn{font-size:12.5px;color:var(--muted);margin-top:26px;border-top:1px solid var(--line);padding-top:12px}
`

const page = (title, body, isHub = false) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${title} — ITSea internal</title>
<style>${CSS}</style></head><body><div class="wrap">
${isHub ? '' : '<a class="back" href="./">← Internal docs</a>'}
<div class="eyebrow">ITSea · Josbin POS — internal &amp; confidential</div>
${body}
<p class="warn">Access is password-protected and for the ITSea/Josbin team only. Do not share the link or password with customers. Secret <i>values</i> (API keys, passwords) are deliberately never in these documents — only their locations.</p>
</div></body></html>`

// wrap tables for horizontal scroll on phones
const wrapTables = (html) => html.replaceAll('<table>', '<div class="tblwrap"><table>').replaceAll('</table>', '</table></div>')

const cards = []
for (const [src, slug, title, desc] of DOCS) {
  const abs = resolve(ROOT, src)
  if (src.endsWith('.html')) {
    copyFileSync(abs, resolve(OUT, `${slug}.html`))
  } else {
    const md = readFileSync(abs, 'utf8')
    // Markdown files that open with their own `# Title` keep it; otherwise
    // the hub title is injected so every page has exactly one h1.
    const heading = /^#\s/.test(md.trimStart()) ? '' : `<h1>${title}</h1>`
    writeFileSync(resolve(OUT, `${slug}.html`), page(title, heading + wrapTables(marked.parse(md))))
  }
  cards.push(`<a class="card" href="${slug}.html"><b>${title}</b><span>${desc}</span></a>`)
}

writeFileSync(resolve(OUT, 'index.html'), page('Internal docs',
  `<h1>Internal documentation</h1>
   <p style="color:var(--muted);margin-top:-6px">Continuity, open points, engineering records and research — the private side of Josbin POS. Start with <b>Pending points</b>.</p>
   ${cards.join('\n')}`, true))

console.log(`internal docs built: ${DOCS.length + 1} pages → internal-docs-dist/`)
