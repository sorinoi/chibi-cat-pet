import { powerMonitor } from 'electron'
import { USER_IDLE } from './config'

export interface UserIdleWatcher {
  readonly idle: boolean
  dispose(): void
}

/** FR-07: reports when the user has not used the machine for `thresholdSeconds()`. */
export function watchUserIdle(
  thresholdSeconds: () => number,
  onChange: (idle: boolean) => void
): UserIdleWatcher {
  let idle = false
  const timer = setInterval(() => {
    const now = powerMonitor.getSystemIdleTime() >= thresholdSeconds()
    if (now === idle) return
    idle = now
    onChange(idle)
  }, USER_IDLE.pollIntervalMs)

  return {
    get idle() {
      return idle
    },
    dispose() {
      clearInterval(timer)
    }
  }
}
