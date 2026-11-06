import koffi from 'koffi'
import { FULLSCREEN } from './config'
import { isFullscreenState } from './lib/notificationState'

export interface FullscreenWatcher {
  readonly fullscreen: boolean
  dispose(): void
}

type QueryState = (out: number[]) => number

/** Binds shell32!SHQueryUserNotificationState through koffi. Returns null if unavailable. */
function bindQuery(): QueryState | null {
  try {
    const shell32 = koffi.load('shell32.dll')
    return shell32.func(
      'int __stdcall SHQueryUserNotificationState(_Out_ int *state)'
    ) as QueryState
  } catch (err) {
    console.error('Fullscreen detection unavailable:', err)
    return null
  }
}

/**
 * FR-16: polls whether a fullscreen app is in front and reports changes.
 * One cheap shell32 call every FULLSCREEN.pollIntervalMs. If the call is unavailable
 * the watcher stays "not fullscreen" so the pet keeps working.
 */
export function watchFullscreen(onChange: (fullscreen: boolean) => void): FullscreenWatcher {
  const query = bindQuery()
  let fullscreen = false
  const out = [0]

  const poll = (): void => {
    if (!query) return
    // HRESULT: 0 (S_OK) on success; keep the last state on failure.
    if (query(out) !== 0) return
    const now = isFullscreenState(out[0])
    if (now === fullscreen) return
    fullscreen = now
    onChange(fullscreen)
  }

  const timer = query ? setInterval(poll, FULLSCREEN.pollIntervalMs) : null
  return {
    get fullscreen() {
      return fullscreen
    },
    dispose() {
      if (timer) clearInterval(timer)
    }
  }
}
