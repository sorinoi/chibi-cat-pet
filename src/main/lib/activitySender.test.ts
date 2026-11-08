import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityState } from '../../shared/ipc'
import { createActivitySender, type SenderTarget } from './activitySender'
import { createOutbox, type Outbox } from './outbox'
import { testEvent } from './testActivity'

const MIN = 60_000
const timing = { batchSize: 2, timeoutMs: 10_000, retryMinMs: MIN, retryMaxMs: 30 * MIN }

let dir: string
let outbox: Outbox
let target: SenderTarget
let n: number
/** What the fake server answers next: a status, or 'down' for no connection. */
let answers: Array<number | 'down'>
let requests: Array<{ url: string; ids: string[]; auth: string | undefined }>
let states: ActivityState[]

const fakeFetch = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
  const body = init.body
    ? (JSON.parse(String(init.body)) as { events: Array<{ id: string }> })
    : null
  const headers = init.headers as Record<string, string>
  requests.push({ url, ids: body?.events.map((e) => e.id) ?? [], auth: headers['Authorization'] })
  const answer = answers.shift() ?? 200
  if (answer === 'down') throw new TypeError('fetch failed')
  return new Response('{}', { status: answer })
})

function sender() {
  return createActivitySender({
    outbox,
    target: () => target,
    fetch: fakeFetch,
    timing,
    now: () => Date.now(),
    onState: (s) => states.push(s)
  })
}

const add = (count: number): void => {
  for (let i = 0; i < count; i++) outbox.append(testEvent(Date.now(), ++n))
}
/** Lets the awaited fetch calls finish. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_794_000_000_000 })
  dir = mkdtempSync(join(tmpdir(), 'pet-sender-'))
  outbox = createOutbox({
    path: join(dir, 'outbox.jsonl'),
    maxEvents: 100,
    maxAgeMs: 30 * 24 * 60 * MIN
  })
  target = { enabled: true, url: 'https://pets.example.com/', key: 'secret-key' }
  n = 0
  answers = []
  requests = []
  states = []
  fakeFetch.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('activity sender (requirement-v6.md FR-84..FR-86)', () => {
  it('sends the outbox in batches with the key, and empties it', async () => {
    const s = sender()
    add(5)
    s.kick()
    await settle()
    expect(requests.map((r) => r.ids.length)).toEqual([2, 2, 1])
    expect(requests[0]?.url).toBe('https://pets.example.com/api/v1/events')
    expect(requests[0]?.auth).toBe('Bearer secret-key')
    expect(outbox.count()).toBe(0)
    expect(s.state()).toMatchObject({ kind: 'ready', waiting: 0, lastSentAt: Date.now() })
  })

  it('keeps events when offline and retries later, waiting longer each time', async () => {
    const s = sender()
    answers = ['down', 'down', 200]
    add(1)
    s.kick()
    await settle()
    expect(s.state()).toMatchObject({ kind: 'retrying', reason: 'offline', waiting: 1 })
    add(1)
    s.kick() // a retry is scheduled: no new request now
    await settle()
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(MIN) // 1st retry: still down
    expect(requests).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(MIN) // next wait is 2 minutes
    expect(requests).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(MIN)
    await settle()
    expect(requests).toHaveLength(3)
    expect(outbox.count()).toBe(0)
  })

  it('a re-sent batch carries the same ids, so the server can skip duplicates (FR-86)', async () => {
    const s = sender()
    answers = [500, 200]
    add(2)
    s.kick()
    await settle()
    expect(s.state()).toMatchObject({ kind: 'retrying', reason: 'server' })
    s.retryNow() // e.g. the PC woke up
    await settle()
    expect(requests[1]?.ids).toEqual(requests[0]?.ids)
    expect(outbox.count()).toBe(0)
  })

  it('stops on a refused key until the settings change (FR-85)', async () => {
    const s = sender()
    answers = [401]
    add(1)
    s.kick()
    await settle()
    expect(s.state()).toMatchObject({ kind: 'refused', reason: 'unauthorized', code: 401 })
    add(1)
    s.kick()
    await settle()
    expect(requests).toHaveLength(1)
    target = { ...target, key: 'new-key' }
    s.targetChanged()
    await settle()
    expect(requests).toHaveLength(2)
    expect(outbox.count()).toBe(0)
  })

  it('sends nothing while off, without a key or with a plain-http internet URL', async () => {
    const s = sender()
    add(1)
    target = { ...target, enabled: false }
    s.kick()
    expect(s.state().kind).toBe('off')
    target = { enabled: true, url: 'https://pets.example.com', key: null }
    s.kick()
    expect(s.state().kind).toBe('notSet')
    target = { enabled: true, url: 'http://pets.example.com', key: 'k' }
    s.kick()
    expect(s.state().kind).toBe('badUrl')
    await settle()
    expect(requests).toHaveLength(0)
    expect(outbox.count()).toBe(1)
  })

  it('test() checks the health endpoint, also with the switch off (FR-87, FR-92)', async () => {
    const s = sender()
    target = { ...target, enabled: false }
    answers = [200, 401, 'down']
    expect(await s.test()).toEqual({ ok: true })
    expect(requests[0]?.url).toBe('https://pets.example.com/api/v1/health')
    expect(await s.test()).toEqual({ ok: false, reason: 'unauthorized' })
    expect(await s.test()).toEqual({ ok: false, reason: 'unreachable' })
    target = { ...target, url: '' }
    expect(await s.test()).toEqual({ ok: false, reason: 'notSet' })
  })

  it('has no timers while nothing waits (NFR-32)', async () => {
    const s = sender()
    add(1)
    s.kick()
    await settle()
    expect(vi.getTimerCount()).toBe(0)
    s.dispose()
  })

  it('clearing the outbox drops a scheduled retry (FR-88)', async () => {
    const s = sender()
    answers = ['down']
    add(1)
    s.kick()
    await settle()
    expect(s.state().kind).toBe('retrying')
    outbox.clear()
    s.cleared()
    expect(s.state()).toMatchObject({ kind: 'ready', waiting: 0 })
    expect(vi.getTimerCount()).toBe(0)
  })
})
