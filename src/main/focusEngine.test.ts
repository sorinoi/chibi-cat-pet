import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOCUS } from '../shared/focusConfig'
import type { FocusSettings, TimerEvent } from '../shared/focusTimer'
import { createFocusEngine, type FocusEngine } from './focusEngine'

const MIN = 60_000

let dir: string
let file: string
let t: number
let settings: FocusSettings
let engines: FocusEngine[]
let events: string[]

function engine(): FocusEngine {
  const e = createFocusEngine({ filePath: file, settings: () => settings, now: () => t })
  e.onChange((_s, evs: TimerEvent[]) => events.push(...evs.map((ev) => ev.type)))
  engines.push(e)
  return e
}

/** Advance the clock and the fake timers together in small steps (the PC stays awake). */
function run(ms: number, stepMs = 1_000): void {
  for (let left = ms; left > 0; left -= stepMs) {
    const step = Math.min(stepMs, left)
    t += step
    vi.advanceTimersByTime(step)
  }
}

const stored = (): unknown => JSON.parse(readFileSync(file, 'utf8'))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pet-focus-'))
  file = join(dir, 'focus.json')
  t = new Date(2026, 10, 6, 9, 0, 0).getTime()
  settings = { ...FOCUS.defaults }
  engines = []
  events = []
  vi.useFakeTimers()
})

afterEach(() => {
  engines.forEach((e) => e.dispose())
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('focus engine: timing (NFR-16, NFR-17)', () => {
  it('ends a focus on time, counts it and saves today', () => {
    const e = engine()
    e.load()
    e.startFocus()
    run(25 * MIN - 1_000)
    expect(e.current().completedToday).toBe(0)
    run(1_000)
    expect(e.current().completedToday).toBe(1)
    expect(events).toEqual(['focusStarted', 'focusCompleted', 'breakStarted'])
    expect(stored()).toEqual({ version: 2, days: { '2026-11-06': 1 } })
  })

  it('reports minutes left, refreshed once a minute while running', () => {
    const e = engine()
    let updates = 0
    e.onChange(() => updates++)
    e.startFocus()
    expect(e.current().minutesLeft).toBe(25)
    updates = 0
    run(10 * MIN)
    expect(updates).toBe(10)
    expect(e.current().minutesLeft).toBe(15)
  })

  it('has no timers running while idle except the midnight reset', () => {
    const e = engine()
    e.load()
    expect(vi.getTimerCount()).toBe(1)
    e.startFocus()
    expect(vi.getTimerCount()).toBe(3)
    e.stop()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('pause stops the clock; resume continues with the time that was left', () => {
    const e = engine()
    e.startFocus()
    run(10 * MIN)
    e.pause()
    run(60 * MIN)
    expect(e.current()).toMatchObject({ minutesLeft: 15, completedToday: 0 })
    e.resume()
    run(15 * MIN)
    expect(e.current().completedToday).toBe(1)
  })

  it('applies changed durations to the next phase only', () => {
    const e = engine()
    e.startFocus()
    settings = { ...settings, focusMinutes: 50, shortBreakMinutes: 10 }
    run(25 * MIN)
    expect(e.current().completedToday).toBe(1)
    expect(e.current().minutesLeft).toBe(10)
  })
})

describe('focus engine: sleep and midnight', () => {
  it('interrupts a focus when the PC slept through it (timers fire late)', () => {
    const e = engine()
    e.startFocus()
    run(5 * MIN)
    // PC asleep for 40 minutes: the wall clock jumps; the next minute tick notices the gap.
    t += 40 * MIN
    run(MIN)
    expect(events).toContain('focusInterrupted')
    expect(e.current()).toMatchObject({ state: { kind: 'idle' }, completedToday: 0 })
  })

  it('check() catches up right after wake, before any timer fires', () => {
    const e = engine()
    e.startFocus()
    run(MIN)
    t += 30 * MIN
    e.check()
    expect(e.current().state.kind).toBe('idle')
    expect(events).toContain('focusInterrupted')
  })

  it("resets today's count at local midnight", () => {
    t = new Date(2026, 10, 6, 23, 30, 0).getTime()
    writeFileSync(file, JSON.stringify({ version: 1, date: '2026-11-06', completed: 5 }))
    const e = engine()
    e.load()
    let latest = -1
    e.onChange((s) => (latest = s.completedToday))
    expect(e.current().completedToday).toBe(5)
    run(31 * MIN, MIN)
    expect(latest).toBe(0)
    expect(e.current().completedToday).toBe(0)
  })
})

describe('focus engine: focus.json (FR-40)', () => {
  it("today's count survives a restart", () => {
    const first = engine()
    first.load()
    first.startFocus()
    run(25 * MIN)
    first.dispose()
    const second = engine()
    expect(second.load()).toBe('ok')
    expect(second.current()).toMatchObject({ completedToday: 1, state: { kind: 'idle' } })
  })

  it("yesterday's file counts as 0 today", () => {
    writeFileSync(file, JSON.stringify({ version: 1, date: '2026-11-05', completed: 7 }))
    const e = engine()
    e.load()
    expect(e.current().completedToday).toBe(0)
  })

  it('moves a damaged file aside and starts at 0', () => {
    writeFileSync(file, '{"version":1,"date":')
    const e = engine()
    expect(e.load()).toBe('damaged')
    expect(existsSync(`${file}.bad`)).toBe(true)
    expect(existsSync(file)).toBe(false)
    expect(e.current().completedToday).toBe(0)
  })

  it('a missing file is fine', () => {
    expect(engine().load()).toBe('missing')
  })
})

describe('focus engine: history (requirement-v4.md FR-48, FR-49)', () => {
  it('upgrades a v3 focus.json and keeps today', () => {
    writeFileSync(file, JSON.stringify({ version: 1, date: '2026-11-06', completed: 3 }))
    const e = engine()
    expect(e.load()).toBe('ok')
    expect(e.current().completedToday).toBe(3)
    e.startFocus()
    run(25 * MIN)
    expect(stored()).toEqual({ version: 2, days: { '2026-11-06': 4 } })
  })

  it('reports the last 7 days, oldest first', () => {
    writeFileSync(file, JSON.stringify({ version: 2, days: { '2026-11-05': 2, '2026-11-01': 6 } }))
    const e = engine()
    e.load()
    const week = e.current().week
    expect(week).toHaveLength(7)
    expect(week[0]).toEqual({ date: '2026-10-31', count: 0 })
    expect(week[1]).toEqual({ date: '2026-11-01', count: 6 })
    expect(week[5]).toEqual({ date: '2026-11-05', count: 2 })
    expect(week[6]).toEqual({ date: '2026-11-06', count: 0 })
  })
})
