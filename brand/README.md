# Brand assets

## `josbin-icon-source.png` — the app icon source

Drop the Josbin logo here as **`josbin-icon-source.png`**, then run:

```bash
node scripts/generate-app-icons.mjs
```

That one file produces every icon the products need:

| Target | What gets written |
|---|---|
| Android launcher | `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` across all 5 density buckets |
| Windows exe + installer | `frontend/build/icon.png` (electron-builder builds the `.ico` from it) |

### What the source file needs to be

- **Square**, at least **1024 × 1024**. Anything smaller looks soft on a
  modern phone or a high-DPI Windows screen.
- **PNG**, transparent background preferred — a white plate is added where
  the platform needs one, and the Android adaptive background is already
  set to white in `ic_launcher_background.xml`.
- **The mark alone**, not the full lock-up. An app icon is displayed at
  about 48 px on a till's home screen; a logo with a company name under it
  becomes an unreadable smudge at that size. The orange symbol on its own
  reads at any size.

The generator insets the artwork to 60% for the Android adaptive
foreground, because launchers crop adaptive icons to a circle or squircle
and un-inset artwork loses its edges.

### After generating

Rebuild both apps — the icons are compiled in, not loaded at runtime:

```bash
cd frontend && npx cap sync android && (cd android && ./gradlew assembleDebug) && npm run build:win
```
