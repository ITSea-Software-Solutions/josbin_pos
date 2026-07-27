#!/usr/bin/env node
/**
 * Generates every app icon — Android launcher icons and the Windows
 * installer/exe icon — from ONE square source image.
 *
 *   node scripts/generate-app-icons.mjs [path/to/source.png]
 *
 * Default source: brand/josbin-icon-source.png
 *
 * Why a script and not hand-exported files: there are 16 Android files
 * across 5 density buckets plus the adaptive-icon foreground, and the
 * Windows icon on top. Cutting those by hand once means cutting them by
 * hand every time the brand changes, and a half-updated icon set is the
 * kind of thing nobody notices until a client does.
 *
 * The source should be at least 1024×1024 and square. Android's adaptive
 * icons crop to a circle on many launchers, so the artwork needs padding —
 * we add it here rather than requiring a pre-padded file.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// sharp is a frontend dependency and this script lives at the repo root, so
// resolve it from there rather than requiring a duplicate install.
const require = createRequire(join(root, 'frontend', 'package.json'))
const sharp = require('sharp')
const source = process.argv[2] ?? join(root, 'brand', 'josbin-icon-source.png')

if (!existsSync(source)) {
  console.error(`\n✗ No source image at: ${source}\n`)
  console.error('  Drop a square PNG (1024×1024 or larger) there and re-run.')
  console.error('  Usage: node scripts/generate-app-icons.mjs [path/to/source.png]\n')
  process.exit(1)
}

const androidRes = join(root, 'frontend', 'android', 'app', 'src', 'main', 'res')
const electronBuild = join(root, 'frontend', 'build')

/** Android launcher densities: folder → legacy icon px. */
const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

/**
 * Adaptive-icon foregrounds are 108dp with only the middle 72dp guaranteed
 * visible — the launcher may mask the rest into a circle or squircle. So the
 * artwork is inset to ~60% and the rest left transparent, otherwise the logo
 * gets its edges shaved off on most Android launchers.
 */
const FOREGROUND_SCALE = 0.6

/** White plate behind the mark: the logo is orange on white, and an orange-on-dark launcher would lose it. */
const PLATE = { r: 255, g: 255, b: 255, alpha: 1 }

async function squareContain(size, background) {
  return sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background })
    .png()
    .toBuffer()
}

async function foreground(size) {
  const inner = Math.round(size * FOREGROUND_SCALE)
  const pad = Math.round((size - inner) / 2)
  const art = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, top: pad, left: pad }])
    .png()
    .toBuffer()
}

const meta = await sharp(source).metadata()
console.log(`source: ${source} (${meta.width}×${meta.height})`)
if ((meta.width ?? 0) < 512) {
  console.warn('⚠ source is under 512px — the icon will look soft on high-density screens')
}
if (meta.width !== meta.height) {
  console.warn('⚠ source is not square — it will be letterboxed onto a square plate')
}

// ── Android ────────────────────────────────────────────────────────────────
for (const [folder, px] of Object.entries(DENSITIES)) {
  const dir = join(androidRes, folder)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'ic_launcher.png'), await squareContain(px, PLATE))
  writeFileSync(join(dir, 'ic_launcher_round.png'), await squareContain(px, PLATE))
  // Adaptive foreground is rendered at 108/48 the legacy size.
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await foreground(Math.round(px * 2.25)))
  console.log(`  android ${folder.padEnd(16)} ${px}px`)
}

// ── Windows (electron-builder reads build/icon.png and builds the .ico) ────
mkdirSync(electronBuild, { recursive: true })
writeFileSync(join(electronBuild, 'icon.png'), await squareContain(512, PLATE))
console.log('  windows build/icon.png    512px')

console.log('\n✓ Icons generated. Rebuild both apps to pick them up.')
