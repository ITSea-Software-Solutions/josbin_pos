/**
 * The CMYK process bar — Josbin's signature device.
 *
 * Cyan, magenta, yellow and key are the four inks a press lays down, and
 * Josbin's business is the machines that lay them. Anyone in the trade reads
 * this bar instantly; no POS competitor can borrow it without looking like
 * they took it.
 *
 * It is decoration and nothing else. These four hues never become a button,
 * a status, or a chart series — the moment they carry meaning they start
 * competing with the semantic palette and the screen argues with itself.
 */
export default function ProcessBar({
  width = '100%',
  height = 4,
  onDark = false,
}: {
  width?: number | string
  /** 4px reads as a signature; 3 disappears, 6 becomes a stripe. */
  height?: number
  /** Flips the key block to near-white so it stays visible on a dark ground. */
  onDark?: boolean
}) {
  const inks = ['#00AEEF', '#EC008C', '#FFF200', onDark ? '#F5FAFF' : '#002739']
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        width,
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {inks.map((ink) => (
        <div key={ink} style={{ flex: 1, background: ink }} />
      ))}
    </div>
  )
}
