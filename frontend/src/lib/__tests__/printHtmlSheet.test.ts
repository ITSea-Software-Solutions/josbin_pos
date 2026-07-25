import { afterEach, describe, expect, it, vi } from 'vitest'
import { printHtmlSheet } from '@/lib/hardware'
import { CapacitorPrinter } from '@/lib/capacitor-printer'

// printHtmlSheet routes to the Capacitor bridge on Android — mock the bridge
// module (the native plugin only exists inside a compiled APK).
vi.mock('@/lib/capacitor-printer', () => ({
  CapacitorPrinter: {
    printHtml: vi.fn(),
    printEscPos: vi.fn(),
    tcpPrint: vi.fn(),
  },
}))

const printHtmlMock = vi.mocked(CapacitorPrinter.printHtml)

function setAndroid() {
  ;(window as any).Capacitor = { isNativePlatform: () => true }
}

afterEach(() => {
  delete (window as any).Capacitor
  delete (window as any).josbin_pos
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('printHtmlSheet on Android', () => {
  it('routes the HTML to the native PrintManager bridge (window.print is a no-op in the WebView)', async () => {
    setAndroid()
    printHtmlMock.mockResolvedValueOnce({ success: true })

    const res = await printHtmlSheet('Labels', '<html><body>x</body></html>')

    expect(printHtmlMock).toHaveBeenCalledWith('Labels', '<html><body>x</body></html>')
    expect(res).toEqual({ success: true })
  })

  it('propagates a bridge failure so screens can surface it', async () => {
    setAndroid()
    printHtmlMock.mockResolvedValueOnce({ success: false, error: 'print cancelled' })

    const res = await printHtmlSheet('Labels', '<html></html>')

    expect(res.success).toBe(false)
    expect(res.error).toBe('print cancelled')
  })
})

describe('printHtmlSheet on web/Electron', () => {
  it('writes the document into a hidden iframe and calls print() after the image-settle delay', async () => {
    vi.useFakeTimers()

    const res = await printHtmlSheet('Labels', '<html><body><p id="mk">hello-mark</p></body></html>')
    expect(res.success).toBe(true)
    expect(printHtmlMock).not.toHaveBeenCalled()

    const frame = document.querySelector('iframe[data-josbin-print-frame]') as HTMLIFrameElement
    expect(frame).toBeTruthy()
    expect(frame.contentDocument?.body.innerHTML).toContain('hello-mark')

    const printSpy = vi.fn()
    ;(frame.contentWindow as any).print = printSpy
    expect(printSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('reuses a single hidden iframe across prints', async () => {
    vi.useFakeTimers()
    await printHtmlSheet('A', '<html><body>a</body></html>')
    await printHtmlSheet('B', '<html><body>b</body></html>')

    const frames = document.querySelectorAll('iframe[data-josbin-print-frame]')
    expect(frames).toHaveLength(1)
    expect((frames[0] as HTMLIFrameElement).contentDocument?.body.innerHTML).toContain('b')
  })
})
