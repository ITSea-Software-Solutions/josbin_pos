import { useState, useCallback } from 'react'

interface Props {
  onClose: () => void
}

// ─── Layout ───────────────────────────────────────────────────────────────────
// Three rows of keys + a symbols row for Dutch characters.
// Each key is { label, shift?, action? }
type Key = string | { label: string; shift: string } | { label: string; action: string; wide?: boolean }

const ROW1: Key[] = [
  { label: '`', shift: '~' }, { label: '1', shift: '!' }, { label: '2', shift: '@' },
  { label: '3', shift: '#' }, { label: '4', shift: '$' }, { label: '5', shift: '%' },
  { label: '6', shift: '^' }, { label: '7', shift: '&' }, { label: '8', shift: '*' },
  { label: '9', shift: '(' }, { label: '0', shift: ')' }, { label: '-', shift: '_' },
  { label: '=', shift: '+' }, { label: '⌫', action: 'backspace', wide: true },
]
const ROW2: Key[] = [
  { label: 'q', shift: 'Q' }, { label: 'w', shift: 'W' }, { label: 'e', shift: 'E' },
  { label: 'r', shift: 'R' }, { label: 't', shift: 'T' }, { label: 'y', shift: 'Y' },
  { label: 'u', shift: 'U' }, { label: 'i', shift: 'I' }, { label: 'o', shift: 'O' },
  { label: 'p', shift: 'P' }, { label: '[', shift: '{' }, { label: ']', shift: '}' },
  { label: '\\', shift: '|' },
]
const ROW3: Key[] = [
  { label: 'a', shift: 'A' }, { label: 's', shift: 'S' }, { label: 'd', shift: 'D' },
  { label: 'f', shift: 'F' }, { label: 'g', shift: 'G' }, { label: 'h', shift: 'H' },
  { label: 'j', shift: 'J' }, { label: 'k', shift: 'K' }, { label: 'l', shift: 'L' },
  { label: ';', shift: ':' }, { label: "'", shift: '"' },
  { label: '↵', action: 'enter', wide: true },
]
const ROW4: Key[] = [
  { label: '⇧', action: 'shift', wide: true },
  { label: 'z', shift: 'Z' }, { label: 'x', shift: 'X' }, { label: 'c', shift: 'C' },
  { label: 'v', shift: 'V' }, { label: 'b', shift: 'B' }, { label: 'n', shift: 'N' },
  { label: 'm', shift: 'M' }, { label: ',', shift: '<' }, { label: '.', shift: '>' },
  { label: '/', shift: '?' },
  { label: '⇧', action: 'shift', wide: true },
]
// Dutch accented characters row
const DUTCH_ROW: Key[] = [
  'é', 'è', 'ê', 'ë', 'ä', 'ö', 'ü', 'ï', 'ñ',
  { label: 'É', shift: 'É' }, { label: 'IJ', shift: 'ij' },
  { label: '€', shift: '€' }, { label: '°', shift: '°' },
]
const BOTTOM_ROW: Key[] = [
  { label: 'Ctrl', action: 'ctrl', wide: true },
  { label: '←', action: 'arrowleft' },
  { label: '→', action: 'arrowright' },
  { label: '  SPATIE  ', action: 'space', wide: true },
  { label: '←', action: 'arrowleft' },
  { label: '→', action: 'arrowright' },
  { label: '✕ Toetsenbord', action: 'close', wide: true },
]

const ROWS = [ROW1, ROW2, ROW3, ROW4, DUTCH_ROW, BOTTOM_ROW]

// ─── Insert text into the currently focused input/textarea ───────────────────
function insertAtCursor(text: string) {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return

  const start = el.selectionStart ?? el.value.length
  const end   = el.selectionEnd   ?? el.value.length
  const before = el.value.slice(0, start)
  const after  = el.value.slice(end)

  // Directly mutate value and fire synthetic events so React sees the change
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  nativeInputValueSetter?.call(el, before + text + after)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  const newPos = start + text.length
  el.setSelectionRange(newPos, newPos)
}

function pressBackspace() {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return
  const start = el.selectionStart ?? 0
  const end   = el.selectionEnd   ?? 0
  if (start === end && start === 0) return
  const before = start === end ? el.value.slice(0, start - 1) : el.value.slice(0, start)
  const after  = el.value.slice(end)
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  nativeSetter?.call(el, before + after)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  const newPos = start === end ? start - 1 : start
  el.setSelectionRange(newPos, newPos)
}

function pressArrow(direction: 'left' | 'right') {
  const el = document.activeElement as HTMLInputElement | null
  if (!el) return
  const pos = el.selectionStart ?? 0
  const newPos = direction === 'left' ? Math.max(0, pos - 1) : Math.min(el.value.length, pos + 1)
  el.setSelectionRange(newPos, newPos)
}

function pressEnter() {
  const el = document.activeElement as HTMLElement | null
  if (!el) return
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', bubbles: true }))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnScreenKeyboard({ onClose }: Props) {
  const [shifted, setShifted] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const effectiveShift = shifted || capsLock

  const handleKey = useCallback((key: Key) => {
    if (typeof key === 'string') {
      insertAtCursor(effectiveShift ? key.toUpperCase() : key)
      if (shifted && !capsLock) setShifted(false)
      return
    }

    if ('action' in key) {
      switch (key.action) {
        case 'backspace':   pressBackspace(); break
        case 'enter':       pressEnter(); break
        case 'space':       insertAtCursor(' '); break
        case 'arrowleft':   pressArrow('left'); break
        case 'arrowright':  pressArrow('right'); break
        case 'shift':
          if (effectiveShift && !capsLock) {
            setShifted(false)
          } else if (!effectiveShift) {
            setShifted(true)
          } else {
            // currently caps — toggle off
            setCapsLock(false)
            setShifted(false)
          }
          break
        case 'ctrl': {
          // Double-tap shift = caps lock
          setCapsLock((c) => !c)
          setShifted(false)
          break
        }
        case 'close':       onClose(); break
      }
      return
    }

    if ('shift' in key) {
      insertAtCursor(effectiveShift ? key.shift : key.label)
      if (shifted && !capsLock) setShifted(false)
    }
  }, [effectiveShift, shifted, capsLock, onClose])

  function keyLabel(key: Key): string {
    if (typeof key === 'string') return effectiveShift ? key.toUpperCase() : key
    if ('action' in key) {
      if (key.action === 'shift') return effectiveShift ? '⇧●' : '⇧'
      if (key.action === 'ctrl')  return capsLock ? 'CAPS●' : 'CAPS'
      return key.label
    }
    return effectiveShift ? key.shift : key.label
  }

  function isWide(key: Key): boolean {
    if (typeof key === 'string') return false
    return ('action' in key && key.wide === true) || false
  }

  function isAction(key: Key): boolean {
    return typeof key !== 'string' && 'action' in key
  }

  return (
    <div
      onMouseDown={(e) => e.preventDefault()} // prevent focus steal
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1e1e2e',
        borderTop: '2px solid rgba(124,58,237,0.4)',
        padding: '10px 8px 12px',
        zIndex: 900,
        userSelect: 'none',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {ROWS.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            gap: 4,
            justifyContent: 'center',
            marginBottom: ri < ROWS.length - 1 ? 4 : 0,
          }}
        >
          {row.map((key, ki) => {
            const label  = keyLabel(key)
            const wide   = isWide(key)
            const action = isAction(key)
            const isShiftKey = typeof key !== 'string' && 'action' in key && key.action === 'shift'
            const isActive = isShiftKey && effectiveShift

            return (
              <button
                key={ki}
                onMouseDown={(e) => { e.preventDefault(); handleKey(key) }}
                style={{
                  flex: wide ? '0 0 auto' : '0 0 36px',
                  width: wide ? 'auto' : 36,
                  minWidth: wide ? 64 : 36,
                  paddingLeft: wide ? 12 : 0,
                  paddingRight: wide ? 12 : 0,
                  height: 36,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: action ? 600 : 400,
                  fontFamily: 'monospace',
                  transition: 'background 0.08s',
                  background: isActive
                    ? 'rgba(124,58,237,0.7)'
                    : action
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.07)',
                  color: isActive ? '#fff' : action ? '#c4b5fd' : '#e5e5ef',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isActive
                    ? 'rgba(124,58,237,0.85)'
                    : 'rgba(255,255,255,0.18)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isActive
                    ? 'rgba(124,58,237,0.7)'
                    : action
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.07)'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
