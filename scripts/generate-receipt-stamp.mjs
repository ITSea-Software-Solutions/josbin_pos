#!/usr/bin/env node
/**
 * Rasterise the Josbin wing into the packed 1-bit bitmap a thermal printer
 * wants, and emit it as a TypeScript module.
 *
 * Why bake it in rather than fetch it at print time: the till prints when the
 * shop's internet is down — that is the whole point of the product. A logo
 * that has to be downloaded is a logo that is missing on the day it matters.
 * At 240 × 160 dots the packed bitmap is 4.8 KB, which is nothing next to the
 * app bundle.
 *
 *   node scripts/generate-receipt-stamp.mjs
 *
 * Re-run after changing brand/josbin-mark.svg.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from '../frontend/node_modules/sharp/lib/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 80 mm paper is 576 dots across, 58 mm is 384. 240 keeps the stamp
// comfortably inside both without a per-width variant.
const WIDTH = 240
// Threshold above which a pixel counts as "not ink". Thermal paper has no
// greys — every dot is burned or it isn't — so anti-aliased edges have to be
// resolved one way or the other. 190 keeps the wing's tapering feather tips
// visible instead of dropping them.
const LUMA_CUTOFF = 190

const svg = readFileSync(resolve(root, 'brand/josbin-mark.svg'))

const { data, info } = await sharp(svg)
  // Flatten onto white first: the SVG is transparent, and an un-flattened
  // alpha channel greyscales to "everything is dark", which prints a solid
  // black rectangle.
  .flatten({ background: '#ffffff' })
  .resize({ width: WIDTH, fit: 'contain', background: '#ffffff' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true })

const height = info.height
const bytesPerRow = Math.ceil(WIDTH / 8)
const packed = new Uint8Array(bytesPerRow * height)

for (let y = 0; y < height; y++) {
  for (let x = 0; x < WIDTH; x++) {
    if (data[y * info.width + x] >= LUMA_CUTOFF) continue // paper, not ink
    // MSB-first within each byte — the order GS v 0 reads.
    packed[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
  }
}

const inked = packed.reduce((n, b) => n + b.toString(2).replace(/0/g, '').length, 0)
const coverage = ((inked / (WIDTH * height)) * 100).toFixed(1)
if (inked === 0) throw new Error('Rasterised to a blank stamp — check the SVG path.')
if (coverage > 60) throw new Error(`Stamp is ${coverage}% ink — that is a black box, not a logo.`)

// Base64 rather than a 4,800-element array literal: the array literal parses
// slower and makes the file unreadable in review.
const b64 = Buffer.from(packed).toString('base64')

const out = `/**
 * Josbin wing, pre-rasterised for the receipt printer. GENERATED — do not
 * edit by hand; run \`node scripts/generate-receipt-stamp.mjs\` instead.
 *
 * Packed 1 bit per dot, MSB first, ${bytesPerRow} bytes per row — exactly the
 * layout ESC/POS \`GS v 0\` expects, so printing it needs no conversion at the
 * till. ${WIDTH} × ${height} dots, ${coverage}% ink coverage.
 */

export const STAMP_WIDTH = ${WIDTH}
export const STAMP_HEIGHT = ${height}

const PACKED_B64 =
  '${b64}'

let cached: Uint8Array | null = null

/** The packed bitmap. Decoded once, then reused for every receipt. */
export function josbinStampBits(): Uint8Array {
  if (cached) return cached
  const bin = atob(PACKED_B64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  cached = out
  return cached
}
`

const dest = resolve(root, 'frontend/src/lib/receiptStamp.ts')
writeFileSync(dest, out)
console.log(`✓ ${WIDTH}×${height}, ${coverage}% ink → frontend/src/lib/receiptStamp.ts`)
