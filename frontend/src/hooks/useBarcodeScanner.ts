import { useEffect, useRef } from 'react'

/**
 * Hardware barcode scanner capture — independent of which element has focus.
 *
 * A USB or Bluetooth scanner is not a camera, it is a keyboard: it types the
 * barcode and presses Enter. The obvious way to read one is to point it at a
 * focused text box, and that is what this app used to do. It works on a desk
 * with a mouse and fails on a touch till, for two reasons that compound:
 *
 *   1. Every tap moves focus onto the thing tapped. Tap a product tile and
 *      the tile owns the keyboard, so the next scan types into a button and
 *      its closing Enter re-fires that button — the tapped product's
 *      quantity goes up and the scanned product is never added.
 *   2. Re-focusing a text input on Android opens the on-screen keyboard.
 *      Its slide-up animation and the relayout behind it drop the opening
 *      characters of whatever is typed during it — so the first scan is
 *      swallowed whole and only the second one registers.
 *
 * So we stop depending on focus. We listen on the document itself and tell a
 * scanner from a human by SPEED: a scanner emits characters a few
 * milliseconds apart, a person manages maybe one per 150ms. A fast run that
 * ends in Enter is a scan — it is swallowed before it can reach a focused
 * button or a form, and handed to onScan. Anything typed at human speed is
 * left completely alone, so the search box still behaves like a search box.
 *
 * This is how the scan gets read no matter what the cashier last touched,
 * and why the till no longer needs to yank focus around (or pop the on-screen
 * keyboard) after every tap.
 */

/**
 * Longest AVERAGE gap per character that still counts as machine-typed.
 *
 * Judged on the average across the whole code, not on every single gap. A
 * scanner sits at 1–30ms, but the terminal is a modest ARM tablet: one
 * garbage collection or a cart re-render mid-scan can stretch a single gap
 * past any per-key limit. Disqualifying the scan for that would drop it
 * silently — the cashier scans again and we are back to the bug we set out
 * to fix. Averaging absorbs the hiccup and still leaves a wide margin: a
 * person entering a 13-digit code takes three seconds or more, a scanner
 * having a bad day still lands inside 1.3.
 */
const MAX_AVG_GAP_MS = 100

/** Silence longer than this starts a new code rather than extending the old one. */
const RESET_GAP_MS = 500

/** Shorter than this is a keystroke, not a barcode. The shortest real symbology (UPC-E) is 6. */
const MIN_CODE_LENGTH = 4

export interface BarcodeScannerOptions {
  /**
   * Scanning is suppressed while a modal owns the screen — a scan into an
   * open payment or hold-bill dialog must not silently add a product behind it.
   */
  enabled?: boolean
}

export function useBarcodeScanner(
  onScan: (code: string) => void,
  { enabled = true }: BarcodeScannerOptions = {},
) {
  // Refs, not state: these change on every keystroke and must never re-render
  // the POS screen or re-bind the listener mid-scan.
  const onScanRef = useRef(onScan)
  const enabledRef = useRef(enabled)
  const bufferRef = useRef('')
  const lastKeyAtRef = useRef(0)
  const startedAtRef = useRef(0)

  onScanRef.current = onScan
  enabledRef.current = enabled

  useEffect(() => {
    function reset() {
      bufferRef.current = ''
      startedAtRef.current = 0
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return
      // A shortcut (Ctrl+P, Alt+Tab…) is never part of a barcode.
      if (e.ctrlKey || e.altKey || e.metaKey) {
        reset()
        return
      }

      const now = performance.now()

      // Scanners are configurable to end with either Enter or Tab; accept both.
      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = bufferRef.current
        // (length - 1) gaps between length characters.
        const budget = (code.length - 1) * MAX_AVG_GAP_MS
        const machineTyped =
          code.length >= MIN_CODE_LENGTH && lastKeyAtRef.current - startedAtRef.current <= budget
        reset()
        if (!machineTyped) return // human pressing Enter — let the focused field handle it

        // Swallow the terminating key. Without this the Enter also activates
        // whatever button the cashier last tapped, which is the bug where a
        // scan bumps the previous product's quantity.
        e.preventDefault()
        e.stopPropagation()
        onScanRef.current(code)
        return
      }

      // Printable characters only — arrows, F-keys and modifiers report longer names.
      if (e.key.length !== 1) return

      const gap = now - lastKeyAtRef.current
      lastKeyAtRef.current = now

      if (gap > RESET_GAP_MS) {
        bufferRef.current = e.key
        startedAtRef.current = now
        return
      }

      bufferRef.current += e.key
    }

    // Capture phase on the document: this runs before React's own listeners
    // at the app root, which is what lets stopPropagation() keep the scan out
    // of focused inputs and buttons entirely.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])
}
