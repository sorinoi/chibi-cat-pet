import koffi from 'koffi'
import { screen } from 'electron'
import type { DesktopWindow } from './lib/ledges'

/**
 * requirement-v5.md FR-72: the top-level windows, front-most first, read through koffi
 * (user32, dwmapi). Read only when a fall starts (NFR-25); nothing is stored or sent.
 */
export type ListWindows = () => DesktopWindow[]

const GW_HWNDNEXT = 2
const GWL_EXSTYLE = -20
const WS_EX_TRANSPARENT = 0x20
const WS_EX_TOOLWINDOW = 0x80
const WS_EX_APPWINDOW = 0x40000
const WS_EX_NOACTIVATE = 0x08000000
const DWMWA_EXTENDED_FRAME_BOUNDS = 9
const DWMWA_CLOAKED = 14
/** Enough for any real desktop; stops a runaway walk if the z-order changes under us. */
const MAX_WINDOWS = 2000
const TEXT_CHARS = 256

interface Native {
  GetTopWindow(hwnd: number): number
  GetWindow(hwnd: number, cmd: number): number
  IsWindowVisible(hwnd: number): boolean
  IsIconic(hwnd: number): boolean
  IsZoomed(hwnd: number): boolean
  GetWindowLongW(hwnd: number, index: number): number
  GetWindowThreadProcessId(hwnd: number, pid: number[]): number
  GetWindowTextW(hwnd: number, buf: Buffer, max: number): number
  GetClassNameW(hwnd: number, buf: Buffer, max: number): number
  GetWindowRect(hwnd: number, rect: Buffer): boolean
  DwmGetWindowAttribute(hwnd: number, attr: number, out: Buffer, size: number): number
}

/** Binds the calls once; null if unavailable (then the cat simply falls to the floor). */
function bind(): Native | null {
  try {
    const user32 = koffi.load('user32.dll')
    const dwmapi = koffi.load('dwmapi.dll')
    // HWND as a pointer-sized integer: compared and passed back, never dereferenced.
    return {
      GetTopWindow: user32.func('intptr_t __stdcall GetTopWindow(intptr_t hWnd)'),
      GetWindow: user32.func('intptr_t __stdcall GetWindow(intptr_t hWnd, uint32_t uCmd)'),
      IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(intptr_t hWnd)'),
      IsIconic: user32.func('bool __stdcall IsIconic(intptr_t hWnd)'),
      IsZoomed: user32.func('bool __stdcall IsZoomed(intptr_t hWnd)'),
      GetWindowLongW: user32.func('int32_t __stdcall GetWindowLongW(intptr_t hWnd, int nIndex)'),
      GetWindowThreadProcessId: user32.func(
        'uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32_t *pid)'
      ),
      GetWindowTextW: user32.func(
        'int __stdcall GetWindowTextW(intptr_t hWnd, _Out_ uint8_t *buf, int nMaxCount)'
      ),
      GetClassNameW: user32.func(
        'int __stdcall GetClassNameW(intptr_t hWnd, _Out_ uint8_t *buf, int nMaxCount)'
      ),
      GetWindowRect: user32.func(
        'bool __stdcall GetWindowRect(intptr_t hWnd, _Out_ uint8_t *rect)'
      ),
      DwmGetWindowAttribute: dwmapi.func(
        'int32_t __stdcall DwmGetWindowAttribute(intptr_t hwnd, uint32_t attr, _Out_ uint8_t *out, uint32_t size)'
      )
    } as Native
  } catch (err) {
    console.error('Window list unavailable; the cat only lands on the floor:', err)
    return null
  }
}

export function createWindowList(): ListWindows {
  const native = bind()
  if (!native) return () => []
  const n = native
  const text = Buffer.alloc(TEXT_CHARS * 2)
  const rect = Buffer.alloc(16)
  const cloak = Buffer.alloc(4)
  const pid = [0]

  const readText = (fn: (h: number, b: Buffer, max: number) => number, hwnd: number): string => {
    const length = fn(hwnd, text, TEXT_CHARS)
    return length > 0 ? text.toString('utf16le', 0, length * 2) : ''
  }

  /** The visible frame; GetWindowRect includes the invisible resize borders. Physical px. */
  const frame = (hwnd: number): { x: number; y: number; width: number; height: number } => {
    const ok = n.DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, rect, 16) === 0
    if (!ok && !n.GetWindowRect(hwnd, rect)) return { x: 0, y: 0, width: 0, height: 0 }
    const [left, top, right, bottom] = [0, 4, 8, 12].map((o) => rect.readInt32LE(o))
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  return () => {
    const windows: DesktopWindow[] = []
    let hwnd = n.GetTopWindow(0)
    while (hwnd && windows.length < MAX_WINDOWS) {
      const visible = n.IsWindowVisible(hwnd)
      // Hidden windows can neither carry the cat nor cover an edge: skip the slow calls.
      if (visible) {
        const ex = n.GetWindowLongW(hwnd, GWL_EXSTYLE)
        n.GetWindowThreadProcessId(hwnd, pid)
        const cloaked =
          n.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloak, 4) === 0 &&
          cloak.readUInt32LE(0) !== 0
        windows.push({
          id: hwnd,
          rect: screen.screenToDipRect(null, frame(hwnd)),
          title: readText(n.GetWindowTextW, hwnd),
          className: readText(n.GetClassNameW, hwnd),
          visible,
          minimized: n.IsIconic(hwnd),
          maximized: n.IsZoomed(hwnd),
          cloaked,
          own: pid[0] === process.pid,
          toolWindow: (ex & WS_EX_TOOLWINDOW) !== 0,
          noActivate: (ex & WS_EX_NOACTIVATE) !== 0,
          appWindow: (ex & WS_EX_APPWINDOW) !== 0,
          clickThrough: (ex & WS_EX_TRANSPARENT) !== 0
        })
      }
      hwnd = n.GetWindow(hwnd, GW_HWNDNEXT)
    }
    return windows
  }
}
