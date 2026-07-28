/**
 * Generates the Josbin wing mark as SVG.
 *
 * The mark is a tessellated wing: rounded segments laid out on a curved grid
 * that sweeps from a heavy root at the lower left to a fine tail at the upper
 * right, the cells shrinking and thinning as they go. Hand-authoring ~30
 * rounded quads as path data would be unreadable and unmaintainable, so the
 * geometry is generated from a spine curve and a tapering half-width — the
 * shape is described by its rule, not by its coordinates.
 */
import { writeFileSync } from 'fs'

const W = 300, H = 220
const ORANGE = '#EF6C00'

/** Spine: root at lower-left, tail sweeping up and right. */
const spine = (u) => ({
  x: 30 + 258 * u,
  y: 200 - 214 * u + 84 * u * u,
})

/** Half-width across the wing — heavy at the root, vanishing at the tail. */
const halfWidth = (u) => 66 * Math.pow(1 - u, 0.58) + 1.2

/** Unit normal to the spine at u, for laying cells across the wing. */
const normal = (u) => {
  const d = 1e-4
  const a = spine(Math.max(0, u - d)), b = spine(Math.min(1, u + d))
  const tx = b.x - a.x, ty = b.y - a.y
  const len = Math.hypot(tx, ty) || 1
  return { x: -ty / len, y: tx / len }
}

/** Point on the wing surface. v = -1 leading edge … +1 trailing edge. */
const P = (u, v) => {
  const c = spine(u), n = normal(u), w = halfWidth(u)
  return { x: c.x + n.x * v * w, y: c.y + n.y * v * w }
}

/** Rounded quad through 4 corners — corner radius scales with cell size. */
function roundedQuad(pts, r) {
  const n = pts.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n]
    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y }
    const toNext = { x: next.x - cur.x, y: next.y - cur.y }
    const lp = Math.hypot(toPrev.x, toPrev.y) || 1
    const ln = Math.hypot(toNext.x, toNext.y) || 1
    const rr = Math.min(r, lp / 2.2, ln / 2.2)
    const a = { x: cur.x + (toPrev.x / lp) * rr, y: cur.y + (toPrev.y / lp) * rr }
    const b = { x: cur.x + (toNext.x / ln) * rr, y: cur.y + (toNext.y / ln) * rr }
    d += (i === 0 ? `M${a.x.toFixed(1)},${a.y.toFixed(1)}` : `L${a.x.toFixed(1)},${a.y.toFixed(1)}`)
    d += `Q${cur.x.toFixed(1)},${cur.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`
  }
  return d + 'Z'
}

const ROWS = 4        // bands across the wing
const COLS = 7        // segments along it
const cells = []
const allPts = []

for (let j = 0; j < ROWS; j++) {
  // Rows sit between v0 and v1; the wing is read from leading to trailing edge.
  const v0 = -1 + (2 * j) / ROWS
  const v1 = -1 + (2 * (j + 1)) / ROWS

  for (let i = 0; i < COLS; i++) {
    // Columns bunch toward the tail so segments read as accelerating away.
    const u0 = Math.pow(i / COLS, 0.86)
    const u1 = Math.pow((i + 1) / COLS, 0.86)

    // Gap between cells grows slightly toward the tail, so the far segments
    // separate into the fine streaks the mark ends on.
    const gapU = 0.012 + 0.016 * u0
    const gapV = 0.10 + 0.16 * u0

    const a0 = u0 + gapU, a1 = Math.max(a0 + 0.004, u1 - gapU)
    const b0 = v0 + gapV * (v1 - v0), b1 = v1 - gapV * (v1 - v0)

    // The lower rows run the full length; upper rows stop short, which is what
    // gives the mark its swept, feathered silhouette instead of a plain fan.
    const reach = 1 - j * 0.055
    if (a0 > reach) continue

    const pts = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]
    allPts.push(...pts)
    const size = Math.hypot(pts[0].x - pts[2].x, pts[0].y - pts[2].y)
    cells.push(roundedQuad(pts, Math.min(6, size * 0.22)))
  }
}

const xs = allPts.map((p) => p.x), ys = allPts.map((p) => p.y)
const pad = 6
const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
const vbW = +(maxX - minX).toFixed(1), vbH = +(maxY - minY).toFixed(1)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${vbW} ${vbH}" width="${vbW}" height="${vbH}" role="img" aria-label="Josbin">
  <title>Josbin</title>
  <!--
    Josbin wing mark. Generated from a spine curve and a tapering half-width
    (scripts see gen-wing.mjs) rather than hand-plotted, so the proportions can
    be retuned by changing the rule instead of redrawing 28 paths.
    Single flat colour — scales from a 48px launcher icon to signage.
  -->
  <g fill="${ORANGE}">
${cells.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`

writeFileSync(process.argv[2] ?? 'josbin-wing.svg', svg)
console.log(`wrote ${cells.length} segments`)
