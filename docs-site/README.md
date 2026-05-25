# Josbin POS — Documentation Site

VitePress front-end for the project's documentation. Renders the canonical markdown files from `/docs/` and `/user_manual/` as a single navigable HTML site with search, sidebar, theme toggle, and per-page Print-to-PDF.

## Run it

```bash
cd docs-site
npm install      # one-off
npm run dev      # → http://localhost:5180
```

Open in any browser. Two sidebar sections:

- **Developer Docs** — for engineers maintaining the platform (`/docs/`).
- **User Manual** — for cashiers and store managers (`/user_manual/`).

Press `/` to search across both books.

## Save a page as PDF

VitePress has a print stylesheet that hides chrome (sidebar, nav, search) when printing.

1. Open any page in your browser.
2. **File → Print** (or `Cmd-P` / `Ctrl-P`).
3. Choose **Save as PDF** as the destination.

Each page becomes a clean, self-contained PDF.

## What's where

```
docs-site/
├── .vitepress/
│   └── config.ts        # sidebar, theme, search, etc.
├── index.md             # landing page
├── package.json         # vitepress dev/build scripts
└── README.md            # this file

../docs/                 # developer docs (rendered as /docs/)
../user_manual/          # POS user manual (rendered as /user_manual/)
```

The canonical markdown stays in `../docs/` and `../user_manual/`. VitePress reads from there via `srcDir: '..'` in the config — no duplication.

## Adding a new chapter

1. Drop the new `.md` file in `/docs/` or `/user_manual/`.
2. Add a sidebar entry in `docs-site/.vitepress/config.ts` (under the matching section's `items` array).
3. Refresh the dev server — VitePress hot-reloads.

## Production build (known issue)

`npm run build` currently fails with a Rollup resolution error specific to VitePress 1.5/1.6 when `srcDir` points outside the project. This affects only the static export to `dist/` — **dev mode renders everything correctly**.

Workarounds if you need static files for distribution:

1. **Print every page to PDF** (the lowest-friction option — gives you one PDF per chapter that you can stitch with any PDF merger).
2. **Move/symlink content into `docs-site/`** before building, then run `npm run build`. The sidebar paths will need updating.
3. **Wait for a VitePress patch** — this is a tracked upstream quirk.

For day-to-day use (browsing the docs as a developer, demoing them to a client over screen-share, generating individual PDFs), `npm run dev` is all you need.
