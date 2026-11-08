/**
 * requirement-v6.md FR-84..FR-86, FR-92, NFR-31, NFR-32: sends the outbox to the user's server.
 * One request at a time; timers only while events wait after a failure. `fetch` is passed in
 * (Electron's net.fetch in the app, a fake in tests), so there are no Electron imports here.
 */
import { ACTIVITY_PATHS, checkServerUrl, type ActivityEvent } from '../../shared/activity'
import type { ActivityState, ActivityTestResult } from '../../shared/ipc'
import type { Outbox } from './outbox'

export interface SenderTarget {
  /** The "Send activity to my server" switch (FR-83, FR-87). */
  enabled: boolean
  url: string
  /** null when no key is stored. */
  key: string | null
}

export interface SenderTiming {
  batchSize: number
  timeoutMs: number
  retryMinMs: number
  retryMaxMs: number
}

export interface ActivitySender {
  /** New events are waiting: send now, unless a retry is already scheduled. */
  kick(): void
  /** The network may be back (PC woke up): try now, from the shortest wait again. */
  retryNow(): void
  /** URL, key or switch changed: forget an earlier refusal and try again (FR-85). */
  targetChanged(): void
  /** FR-88: the outbox was emptied; a scheduled retry has nothing left to send. */
  cleared(): void
  state(): ActivityState
  /** FR-87, FR-92: GET /api/v1/health with the key. */
  test(): Promise<ActivityTestResult>
  dispose(): void
}

export interface SenderOptions {
  outbox: Outbox
  target: () => SenderTarget
  fetch: (url: string, init: RequestInit) => Promise<Response>
  timing: SenderTiming
  now?: () => number
  onState?: (state: ActivityState) => void
}

type Outcome =
  | { kind: 'sent' }
  | { kind: 'retry'; reason: 'offline' | 'server' | 'busy' }
  | { kind: 'refused'; reason: 'unauthorized' | 'badData' | 'other'; code: number }

function outcomeOf(status: number): Outcome {
  if (status >= 200 && status < 300) return { kind: 'sent' }
  if (status === 429) return { kind: 'retry', reason: 'busy' }
  if (status >= 500) return { kind: 'retry', reason: 'server' }
  if (status === 401 || status === 403)
    return { kind: 'refused', reason: 'unauthorized', code: status }
  if (status === 400 || status === 413 || status === 422)
    return { kind: 'refused', reason: 'badData', code: status }
  return { kind: 'refused', reason: 'other', code: status }
}

export function createActivitySender({
  outbox,
  target,
  fetch,
  timing,
  now = () => Date.now(),
  onState
}: SenderOptions): ActivitySender {
  let sending = false
  let failures = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAt: number | null = null
  let lastReason: 'offline' | 'server' | 'busy' = 'offline'
  let refused: { reason: 'unauthorized' | 'badData' | 'other'; code: number } | null = null
  let lastSentAt: number | null = null
  let disposed = false
  let last = ''

  /** The address and key to use, or why there are none. */
  function resolve(): { url: string; key: string } | 'off' | 'notSet' | 'badUrl' {
    const t = target()
    if (!t.enabled) return 'off'
    if (!t.key || t.url.trim() === '') return 'notSet'
    const checked = checkServerUrl(t.url)
    return checked.ok ? { url: checked.url, key: t.key } : 'badUrl'
  }

  function state(): ActivityState {
    const base = { waiting: outbox.count(), dropped: outbox.dropped(), lastSentAt }
    const r = resolve()
    if (typeof r === 'string') return { ...base, kind: r }
    if (refused) return { ...base, kind: 'refused', ...refused }
    if (sending) return { ...base, kind: 'sending' }
    if (retryAt !== null) return { ...base, kind: 'retrying', retryAt, reason: lastReason }
    return { ...base, kind: 'ready' }
  }

  function publish(): void {
    if (!onState) return
    const s = state()
    const key = JSON.stringify(s)
    if (key === last) return
    last = key
    onState(s)
  }

  function clearRetry(): void {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    retryAt = null
  }

  function scheduleRetry(reason: 'offline' | 'server' | 'busy'): void {
    clearRetry()
    lastReason = reason
    const wait = Math.min(timing.retryMaxMs, timing.retryMinMs * 2 ** failures)
    failures += 1
    retryAt = now() + wait
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryAt = null
      void pump()
    }, wait)
  }

  /** One request with a time limit; network errors come back as a retry. */
  async function post(url: string, key: string, events: ActivityEvent[]): Promise<Outcome> {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), timing.timeoutMs)
    try {
      const res = await fetch(url + ACTIVITY_PATHS.events, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ events }),
        signal: abort.signal
      })
      return outcomeOf(res.status)
    } catch {
      return { kind: 'retry', reason: 'offline' }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Sends batches until the outbox is empty or something fails. */
  async function pump(): Promise<void> {
    if (sending || disposed) return
    sending = true
    try {
      for (;;) {
        const r = resolve()
        if (typeof r === 'string' || refused || retryTimer || outbox.count() === 0) break
        const batch = outbox.peek(timing.batchSize)
        if (batch.length === 0) break
        publish()
        const outcome = await post(r.url, r.key, batch)
        if (disposed) return
        if (outcome.kind === 'sent') {
          outbox.remove(new Set(batch.map((e) => e.id)))
          failures = 0
          lastSentAt = now()
          continue
        }
        if (outcome.kind === 'retry') scheduleRetry(outcome.reason)
        else refused = { reason: outcome.reason, code: outcome.code }
        break
      }
    } finally {
      sending = false
      publish()
    }
  }

  return {
    kick() {
      publish()
      void pump()
    },
    retryNow() {
      if (retryTimer === null) return
      clearRetry()
      failures = 0
      void pump()
    },
    targetChanged() {
      refused = null
      failures = 0
      clearRetry()
      publish()
      void pump()
    },
    cleared() {
      clearRetry()
      failures = 0
      publish()
    },
    state,
    // Works with the switch off too, so the user can check before turning it on.
    async test() {
      const t = target()
      if (!t.key || t.url.trim() === '') return { ok: false, reason: 'notSet' }
      const checked = checkServerUrl(t.url)
      if (!checked.ok) return { ok: false, reason: 'badUrl' }
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), timing.timeoutMs)
      try {
        const res = await fetch(checked.url + ACTIVITY_PATHS.health, {
          method: 'GET',
          headers: { Authorization: `Bearer ${t.key}` },
          signal: abort.signal
        })
        if (res.ok) return { ok: true }
        if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
        return { ok: false, reason: 'server', code: res.status }
      } catch {
        return { ok: false, reason: 'unreachable' }
      } finally {
        clearTimeout(timer)
      }
    },
    dispose() {
      disposed = true
      clearRetry()
    }
  }
}
