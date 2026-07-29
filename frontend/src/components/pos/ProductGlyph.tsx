/**
 * A drawn stand-in for a product that has no photograph.
 *
 * Every tile used to show the same 📦 carton, which made a wall of products
 * read as one repeating texture — the cashier had nothing but the name to aim
 * at. These are simple flat goods drawn per category, so a shelf of bread does
 * not look like a shelf of bottles, and the eye can land before the reading
 * does.
 *
 * Drawn rather than photographed, deliberately:
 *   - the till must work with no internet, so nothing may be fetched
 *   - a photo set for a supermarket is tens of megabytes and licensing to
 *     track; these are a few hundred bytes each and ours
 *   - one visual family looks intentional. Mixed stock photography does not.
 *
 * A real uploaded product photo always wins — this is the fallback, and it
 * serves every store that has not photographed its catalogue, not only the
 * demo data.
 */

type GlyphKey =
  | 'bread' | 'dairy' | 'drink' | 'beer' | 'meat' | 'fish' | 'produce'
  | 'grain' | 'snack' | 'frozen' | 'cleaning' | 'household' | 'baby'
  | 'health' | 'box'

/**
 * Category name → drawing. Matched on substrings in BOTH languages, because
 * a store names its own categories and we cannot rely on ours: "Bakkerij",
 * "Bakery", "Brood" all want the loaf.
 */
const RULES: Array<[GlyphKey, RegExp]> = [
  ['bread',    /bak|brood|bread|pastry|gebak/i],
  ['dairy',    /zuivel|dairy|melk|milk|kaas|cheese|yog|boter|butter|egg|ei\b/i],
  ['beer',     /bier|beer|alcohol|wijn|wine|sterke/i],
  ['drink',    /drank|drink|beverage|frisdrank|soda|sap|juice|water|koffie|coffee|thee|tea/i],
  ['meat',     /vlees|meat|kip|chicken|poultry|gevogelte|worst|sausage/i],
  ['fish',     /vis\b|fish|zee|seafood|garnal|shrimp/i],
  ['produce',  /groent|veget|fruit|vers|produce|aardappel|potato|salade/i],
  ['grain',    /rijst|rice|meel|flour|pasta|graan|grain|droog|dry goods|bonen|bean|suiker|sugar/i],
  ['snack',    /snack|chips|koek|biscuit|cracker|choco|candy|snoep|noten|nuts/i],
  ['frozen',   /diepvries|frozen|ijs\b|ice/i],
  ['cleaning', /schoon|clean|zeep|soap|wasmiddel|detergent|hygi/i],
  ['baby',     /baby|luier|diaper/i],
  ['health',   /gezond|health|medic|apotheek|pharma|verzorg|care/i],
  ['household',/huishoud|household|hardware|keuken|kitchen|gereedschap|tool|papier|paper/i],
]

export function glyphForCategory(category?: string | null): GlyphKey {
  if (!category) return 'box'
  for (const [key, re] of RULES) if (re.test(category)) return key
  return 'box'
}

/**
 * One colour per glyph, picked to survive BOTH themes — each has to hold
 * against a near-white day card and a deep teal night one. Dairy is the
 * awkward one: milk is white, and white-on-white is invisible, so it is
 * pitched down to a cream that still reads as milk.
 */
const PAINT: Record<GlyphKey, string> = {
  bread: '#C98B3F', dairy: '#CFC2A2', drink: '#3FA9D6', beer: '#D9A21B',
  meat: '#C2606B', fish: '#7FB3C4', produce: '#5FA84E', grain: '#D2B77A',
  snack: '#E0913C', frozen: '#8FC4DE', cleaning: '#4FB0A0', household: '#8C93A8',
  baby: '#E4A0BE', health: '#7BA7E0', box: '#9AA7B2',
}

/** Paths drawn on a 48×48 grid, one silhouette each — read at tile size. */
const PATHS: Record<GlyphKey, string> = {
  bread:    'M8 30c0-8 6-14 16-14s16 6 16 14v4a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z',
  dairy:    'M18 8h12v6l4 6v18a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V20l4-6z',
  drink:    'M17 6h14l-2 8v24a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V14z',
  beer:     'M14 12h18v26a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2zM32 18h5a3 3 0 0 1 0 10h-5z',
  meat:     'M6 20c2-8 11-11 20-10s16 7 16 14-9 12-19 11S4 28 6 20zM31 22a5 6 0 1 0 0 12 5 6 0 0 0 0-12z',
  fish:     'M6 24c6-8 14-12 22-12s14 4 14 12-6 12-14 12S12 32 6 24zM42 18l-6 6 6 6z',
  produce:  'M24 12c8 0 14 6 14 14s-6 14-14 14-14-6-14-14 6-14 14-14zM24 12c0-4 2-6 5-7',
  grain:    'M12 16h24l-3 24a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2zM12 16l4-6h16l4 6',
  snack:    'M10 18h28v20a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2zM10 18l3-8h22l3 8',
  frozen:   'M24 8v32M12 16l24 16M36 16L12 32',
  cleaning: 'M20 8h8v8h-8zM16 16h16v22a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z',
  household:'M10 22 24 10l14 12v16a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z',
  baby:     'M24 10a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 40c0-7 5-11 12-11s12 4 12 11z',
  health:   'M20 10h8v10h10v8H28v10h-8V28H10v-8h10z',
  box:      'M8 21h32v17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2zM6 13h36v6H6z',
}

interface Props {
  category?: string | null
  /** Rendered box size in px. The art is a square. */
  size?: number
}

export default function ProductGlyph({ category, size = 44 }: Props) {
  const key = glyphForCategory(category)
  const paint = PAINT[key]
  // Frozen is the only one drawn as strokes — a snowflake has no body.
  const stroked = key === 'frozen'
  // Meat is the only one with a knocked-out subpath: a cut of any shape reads
  // as a blob, but a blob with a bone hole in it reads as meat. Even-odd is
  // scoped to it because elsewhere subpaths overlap deliberately (the fish's
  // tail meets its body) and would punch holes of their own.
  const holed = key === 'meat'

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d={PATHS[key]}
        fill={stroked ? 'none' : paint}
        stroke={paint}
        strokeWidth={stroked ? 3 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fillRule={holed ? 'evenodd' : 'nonzero'}
        opacity={0.92}
      />
    </svg>
  )
}
