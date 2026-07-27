import { describe, it, expect } from 'vitest'
import { needsPrinterTypeHeal } from '../hardware'

/**
 * Regression guard for a bug that made direct USB printing on Android look
 * broken even after it worked: Settings force-reset a saved 'usb' printer
 * back to 'network' on every visit, wiping the pairing the cashier had just
 * made. The rule is tiny; what it must never do is over-reach.
 */
describe('needsPrinterTypeHeal', () => {
  it('leaves an Android till its USB printer', () => {
    // The whole point of the USB Host API support — Android CAN drive it.
    expect(needsPrinterTypeHeal('android', 'usb')).toBe(false)
  })

  it('leaves a Windows till its USB printer', () => {
    expect(needsPrinterTypeHeal('electron', 'usb')).toBe(false)
  })

  it('heals a USB config in a browser tab, where it can never work', () => {
    expect(needsPrinterTypeHeal('web', 'usb')).toBe(true)
  })

  it('never touches network or disabled printers on any platform', () => {
    for (const platform of ['electron', 'android', 'web'] as const) {
      expect(needsPrinterTypeHeal(platform, 'network')).toBe(false)
      expect(needsPrinterTypeHeal(platform, 'none')).toBe(false)
    }
  })
})
