import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBarcodeScanner } from '../useBarcodeScanner'

/**
 * These tests drive the keyboard the way the two real actors do: a scanner
 * typing a few milliseconds per character, and a cashier typing at human
 * speed. Timing is the whole mechanism, so the clock is controlled rather
 * than waited on.
 */

let clock = 0
beforeEach(() => {
  clock = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** Types `text` then the terminator, advancing the clock `gapMs` per key. */
function typeInto(target: EventTarget, text: string, gapMs: number, terminator: string | null = 'Enter') {
  for (const ch of text) {
    clock += gapMs
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }))
  }
  if (terminator) {
    clock += gapMs
    const e = new KeyboardEvent('keydown', { key: terminator, bubbles: true, cancelable: true })
    target.dispatchEvent(e)
    return e
  }
  return null
}

describe('useBarcodeScanner', () => {
  it('reads a machine-speed code ending in Enter', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    typeInto(document, '8712345678906', 5)

    expect(onScan).toHaveBeenCalledExactlyOnceWith('8712345678906')
  })

  it('ignores human-speed typing so the search box still works', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    typeInto(document, 'melk', 150)

    expect(onScan).not.toHaveBeenCalled()
  })

  it('swallows the scan so it cannot re-fire the button the cashier just tapped', () => {
    // The reported bug: tap a product tile, scan the next item, and the
    // scan's closing Enter re-activated the still-focused tile — bumping
    // the tapped product's quantity instead of adding the scanned one.
    const onScan = vi.fn()
    const tile = document.createElement('button')
    const tileClicked = vi.fn()
    tile.addEventListener('click', tileClicked)
    // A focused button fires click on Enter; jsdom does not implement that,
    // so we assert on the thing that causes it — the un-prevented keydown.
    document.body.appendChild(tile)
    tile.focus()

    renderHook(() => useBarcodeScanner(onScan))
    const enter = typeInto(tile, '5410228142324', 4)!

    expect(onScan).toHaveBeenCalledExactlyOnceWith('5410228142324')
    expect(enter.defaultPrevented).toBe(true)
    expect(tileClicked).not.toHaveBeenCalled()
  })

  it('leaves a human Enter alone for the focused field to handle', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    const enter = typeInto(document, 'brood', 200)!

    expect(onScan).not.toHaveBeenCalled()
    expect(enter.defaultPrevented).toBe(false)
  })

  it('accepts Tab as a terminator, for scanners configured that way', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    typeInto(document, '4001724819408', 6, 'Tab')

    expect(onScan).toHaveBeenCalledExactlyOnceWith('4001724819408')
  })

  it('does not treat a couple of fast keystrokes as a barcode', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    typeInto(document, '12', 5)

    expect(onScan).not.toHaveBeenCalled()
  })

  it('survives a stall mid-scan on a busy terminal', () => {
    // The terminal is a modest ARM tablet. A garbage collection or a cart
    // re-render can stall one keystroke by a few hundred milliseconds. If
    // that disqualified the scan the cashier would have to scan twice —
    // exactly the fault this hook exists to remove — so the run is judged
    // on its average speed, not on its worst single gap.
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    const code = '8712345678906'
    code.split('').forEach((ch, i) => {
      clock += i === 6 ? 400 : 5 // one long stall partway through
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ch }))
    })
    clock += 5
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(onScan).toHaveBeenCalledExactlyOnceWith(code)
  })

  it('still rejects a fast human typing a full barcode by hand', () => {
    // 120ms per key is quick touch-typing and nowhere near a scanner. The
    // margin has to stay wide enough that tolerance for stalls does not
    // turn manual entry into a phantom scan.
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    typeInto(document, '8712345678906', 120)

    expect(onScan).not.toHaveBeenCalled()
  })

  it('starts a fresh code after a long silence', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    for (const ch of 'XY') { clock += 5; document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })) }
    clock += 5000 // register idle between customers
    typeInto(document, '8712345678906', 5)

    expect(onScan).toHaveBeenCalledExactlyOnceWith('8712345678906')
  })

  it('stays silent while a modal owns the screen', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan, { enabled: false }))

    typeInto(document, '8712345678906', 5)

    expect(onScan).not.toHaveBeenCalled()
  })

  it('resumes when the modal closes, without remounting', () => {
    const onScan = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }) => useBarcodeScanner(onScan, { enabled }),
      { initialProps: { enabled: false } },
    )

    typeInto(document, '8712345678906', 5)
    expect(onScan).not.toHaveBeenCalled()

    rerender({ enabled: true })
    clock += 1000
    typeInto(document, '5410228142324', 5)
    expect(onScan).toHaveBeenCalledExactlyOnceWith('5410228142324')
  })

  it('ignores keyboard shortcuts', () => {
    const onScan = vi.fn()
    renderHook(() => useBarcodeScanner(onScan))

    for (const ch of '8712345678906') {
      clock += 5
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, ctrlKey: true }))
    }
    clock += 5
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(onScan).not.toHaveBeenCalled()
  })

  it('stops listening once the POS screen unmounts', () => {
    const onScan = vi.fn()
    const { unmount } = renderHook(() => useBarcodeScanner(onScan))

    unmount()
    typeInto(document, '8712345678906', 5)

    expect(onScan).not.toHaveBeenCalled()
  })
})
