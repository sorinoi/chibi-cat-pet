/** requirement-v6.md FR-87: the activity log status line and test result text. Pure. */
import type { ActivityState, ActivityTestResult } from './ipc'
import type { Strings } from './strings'

const MINUTE_MS = 60_000

/** One line for Settings, plus a second one when old events were dropped (FR-89). */
export function activityStatus(state: ActivityState, t: Strings, now: number): string[] {
  const a = t.activity
  const s = a.status
  const lines: string[] = []
  switch (state.kind) {
    case 'off':
      lines.push(state.waiting > 0 ? `${s.off} · ${s.waiting(state.waiting)}` : s.off)
      break
    case 'notSet':
      lines.push(a.notSet)
      break
    case 'badUrl':
      lines.push(a.badUrl)
      break
    case 'ready':
      lines.push(state.waiting > 0 ? s.waiting(state.waiting) : s.ready)
      break
    case 'sending':
      lines.push(s.sending(state.waiting))
      break
    case 'retrying': {
      const minutes = Math.max(1, Math.ceil((state.retryAt - now) / MINUTE_MS))
      lines.push(`${s.waiting(state.waiting)}: ${s.reasons[state.reason]}, ${s.retry(minutes)}`)
      break
    }
    case 'refused': {
      const why =
        state.reason === 'unauthorized'
          ? s.refusedKey
          : state.reason === 'badData'
            ? s.refusedData(state.code)
            : s.refusedOther(state.code)
      lines.push(state.waiting > 0 ? `${why} · ${s.waiting(state.waiting)}` : why)
      break
    }
  }
  if (state.dropped > 0) lines.push(s.dropped(state.dropped))
  return lines
}

export function activityTestText(result: ActivityTestResult, t: Strings): string {
  const a = t.activity
  if (result.ok) return a.testOk
  switch (result.reason) {
    case 'notSet':
      return a.notSet
    case 'badUrl':
      return a.badUrl
    case 'unauthorized':
      return a.unauthorized
    case 'unreachable':
      return a.unreachable
    case 'server':
      return a.serverError(result.code)
  }
}
