import { screen, type BrowserWindow } from 'electron'
import type { CursorNear } from '../shared/ipc'

export interface CursorWatcher {
  /** The pet asks for cursor updates only while it could look (idle, visible, art present). */
  setWatching(on: boolean): void
  dispose(): void
}

/**
 * FR-57 / NFR-21 (requirement-v4.md): polls the cursor at most every `pollMs`, only while the
 * pet asked for it and its window is visible, and sends the position relative to the window
 * only when it changed. Nothing runs otherwise.
 */
export function createCursorWatcher(
  win: BrowserWindow,
  send: (position: CursorNear) => void,
  pollMs: number
): CursorWatcher {
  let wanted = false
  let timer: ReturnType<typeof setInterval> | null = null
  let last = ''

  function poll(): void {
    if (win.isDestroyed() || !win.isVisible()) return stop()
    const p = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const position: CursorNear = {
      x: p.x - b.x,
      y: p.y - b.y,
      width: b.width,
      height: b.height
    }
    const key = `${position.x},${position.y},${position.width},${position.height}`
    if (key === last) return
    last = key
    send(position)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
    last = ''
  }

  function sync(): void {
    const should = wanted && !win.isDestroyed() && win.isVisible()
    if (should && !timer) {
      timer = setInterval(poll, pollMs)
      poll()
    } else if (!should) stop()
  }

  win.on('show', sync)
  win.on('hide', sync)

  return {
    setWatching(on) {
      wanted = on
      sync()
    },
    dispose() {
      wanted = false
      stop()
      if (!win.isDestroyed()) {
        win.off('show', sync)
        win.off('hide', sync)
      }
    }
  }
}
