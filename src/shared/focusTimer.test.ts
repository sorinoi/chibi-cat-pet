import { describe, expect, it } from 'vitest'
import { FOCUS } from './focusConfig'
import {
  IDLE,
  addCompleted,
  advance,
  completedToday,
  localDate,
  minutesLeft,
  msUntilMidnight,
  parseFocusFile,
  focusFileContent,
  lastDays,
  EMPTY_HISTORY,
  pause,
  phaseMs,
  remainingMs,
  resume,
  skip,
  startBreak,
  startFocus,
  stop,
  type FocusSettings,
  type TimerState
} from './focusTimer'

const MIN = 60_000
const T0 = new Date(2026, 10, 6, 9, 0, 0).getTime()
const S: FocusSettings = { ...FOCUS.defaults }

/** Runs `state` until `now`, checking once a minute like the engine (no sleep gaps). */
function runUntil(state: TimerState, from: number, to: number, s = S) {
  let current = state
  let completed = 0
  const events: string[] = []
  for (let t = from + MIN; t <= to; t += MIN) {
    const r = advance(current, t, t - MIN, s)
    current = r.state
    completed += r.completed
    events.push(...r.events.map((e) => ('phase' in e ? `${e.type}:${e.phase}` : e.type)))
  }
  return { state: current, completed, events }
}

describe('phases and durations (section 4)', () => {
  it('uses the configured minutes', () => {
    const s = { ...S, focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 30 }
    expect(phaseMs('focus', s)).toBe(50 * MIN)
    expect(phaseMs('shortBreak', s)).toBe(10 * MIN)
    expect(phaseMs('longBreak', s)).toBe(30 * MIN)
  })

  it('start focus from idle sets the end time on the wall clock', () => {
    const r = startFocus(IDLE, T0, S)
    expect(r.state).toEqual({ kind: 'running', phase: 'focus', endsAt: T0 + 25 * MIN, run: 0 })
    expect(r.events).toEqual([{ type: 'focusStarted' }])
  })

  it('ignores start while a phase runs', () => {
    const running = startFocus(IDLE, T0, S).state
    expect(startFocus(running, T0 + MIN, S).state).toBe(running)
  })

  it('focus end counts once and starts a short break (autoStartBreaks on)', () => {
    const running = startFocus(IDLE, T0, S).state
    expect(advance(running, T0 + 25 * MIN - 1, T0 + 24 * MIN, S).completed).toBe(0)
    const r = advance(running, T0 + 25 * MIN, T0 + 24 * MIN, S)
    expect(r.completed).toBe(1)
    expect(r.events.map((e) => e.type)).toEqual(['focusCompleted', 'breakStarted'])
    expect(r.state).toEqual({
      kind: 'running',
      phase: 'shortBreak',
      endsAt: T0 + 30 * MIN,
      run: 1
    })
  })

  it('a full cycle: 4 focus sessions, short breaks, then a long break that closes the run', () => {
    const s = { ...S, autoStartFocus: true }
    let r = runUntil(startFocus(IDLE, T0, s).state, T0, T0 + 4 * 25 * MIN + 3 * 5 * MIN, s)
    expect(r.completed).toBe(4)
    expect(r.events.filter((e) => e.startsWith('breakStarted'))).toEqual([
      'breakStarted:shortBreak',
      'breakStarted:shortBreak',
      'breakStarted:shortBreak',
      'breakStarted:longBreak'
    ])
    expect(r.state).toMatchObject({ kind: 'running', phase: 'longBreak', run: 4 })
    const afterLong = T0 + 4 * 25 * MIN + 3 * 5 * MIN + 15 * MIN
    r = runUntil(r.state, afterLong - 15 * MIN, afterLong, s)
    expect(r.events).toEqual(['breakOver', 'focusStarted'])
    expect(r.state).toMatchObject({ kind: 'running', phase: 'focus', run: 0 })
  })

  it('longBreakEvery is respected', () => {
    const s = { ...S, longBreakEvery: 2, autoStartFocus: true }
    const r = runUntil(startFocus(IDLE, T0, s).state, T0, T0 + 2 * 25 * MIN + 5 * MIN, s)
    expect(r.events.filter((e) => e.startsWith('breakStarted'))).toEqual([
      'breakStarted:shortBreak',
      'breakStarted:longBreak'
    ])
  })

  it('without autoStartFocus a break ends in idle and keeps the run', () => {
    const r = runUntil(startFocus(IDLE, T0, S).state, T0, T0 + 30 * MIN)
    expect(r.events).toEqual(['focusCompleted', 'breakStarted:shortBreak', 'breakOver'])
    expect(r.state).toEqual({ kind: 'idle', run: 1 })
    // The next focus continues the run towards the long break.
    expect(startFocus(r.state, T0 + 40 * MIN, S).state).toMatchObject({ run: 1 })
  })

  it('without autoStartBreaks the break waits for the user', () => {
    const s = { ...S, autoStartBreaks: false }
    const r = advance(startFocus(IDLE, T0, s).state, T0 + 25 * MIN, T0 + 24 * MIN, s)
    expect(r.state).toEqual({ kind: 'waiting', phase: 'shortBreak', run: 1 })
    expect(r.events).toEqual([{ type: 'focusCompleted' }])
    // A waiting break does not run out on its own.
    expect(advance(r.state, T0 + 99 * MIN, T0 + 98 * MIN, s).state).toBe(r.state)
    const started = startBreak(r.state, T0 + 30 * MIN, s)
    expect(started.state).toEqual({
      kind: 'running',
      phase: 'shortBreak',
      endsAt: T0 + 35 * MIN,
      run: 1
    })
    expect(started.events).toEqual([{ type: 'breakStarted', phase: 'shortBreak' }])
  })
})

describe('skip, pause, resume, stop', () => {
  it('skipping a focus does not count and moves to the break', () => {
    const r = skip(startFocus(IDLE, T0, S).state, T0 + 3 * MIN, S)
    expect(r.completed).toBe(0)
    expect(r.state).toEqual({ kind: 'running', phase: 'shortBreak', endsAt: T0 + 8 * MIN, run: 0 })
  })

  it('skipping a break moves on as if it had ended', () => {
    const inBreak = advance(startFocus(IDLE, T0, S).state, T0 + 25 * MIN, T0 + 24 * MIN, S).state
    expect(skip(inBreak, T0 + 26 * MIN, S).state).toEqual({ kind: 'idle', run: 1 })
    const s = { ...S, autoStartFocus: true }
    expect(skip(inBreak, T0 + 26 * MIN, s).state).toMatchObject({ phase: 'focus', run: 1 })
  })

  it('skipping a waiting break, or a long break, follows the same rules', () => {
    const waitingLong: TimerState = { kind: 'waiting', phase: 'longBreak', run: 4 }
    expect(skip(waitingLong, T0, S).state).toEqual({ kind: 'idle', run: 0 })
    expect(startFocus(waitingLong, T0, S).state).toMatchObject({ phase: 'focus', run: 0 })
  })

  it('pause keeps the remaining time; resume sets a new end time', () => {
    const running = startFocus(IDLE, T0, S).state
    const paused = pause(running, T0 + 10 * MIN).state
    expect(paused).toEqual({ kind: 'paused', phase: 'focus', remainingMs: 15 * MIN, run: 0 })
    // Paused time does not run out, even across a long gap.
    expect(advance(paused, T0 + 300 * MIN, T0, S).state).toBe(paused)
    const resumed = resume(paused, T0 + 60 * MIN).state
    expect(resumed).toEqual({ kind: 'running', phase: 'focus', endsAt: T0 + 75 * MIN, run: 0 })
    expect(pause(IDLE, T0).state).toBe(IDLE)
    expect(resume(running, T0).state).toBe(running)
  })

  it('a paused phase can be skipped', () => {
    const paused = pause(startFocus(IDLE, T0, S).state, T0 + MIN).state
    expect(skip(paused, T0 + 2 * MIN, S).state).toMatchObject({ phase: 'shortBreak' })
  })

  it('stop goes back to idle and restarts the run', () => {
    const running: TimerState = { kind: 'running', phase: 'focus', endsAt: T0, run: 3 }
    expect(stop(running).state).toEqual(IDLE)
    expect(stop(IDLE).state).toBe(IDLE)
  })
})

describe('sleep gaps and clock changes', () => {
  it('a focus that runs through more than 5 min of sleep is interrupted, not counted', () => {
    const running = startFocus(IDLE, T0, S).state
    const r = advance(running, T0 + 12 * MIN, T0 + 6 * MIN, S)
    expect(r.state).toEqual({ kind: 'idle', run: 0 })
    expect(r.events).toEqual([{ type: 'focusInterrupted' }])
    expect(r.completed).toBe(0)
  })

  it('also when the focus would have ended during the sleep', () => {
    const running = startFocus(IDLE, T0, S).state
    const r = advance(running, T0 + 3 * 60 * MIN, T0 + 20 * MIN, S)
    expect(r.completed).toBe(0)
    expect(r.events).toEqual([{ type: 'focusInterrupted' }])
  })

  it('a gap up to the limit is fine', () => {
    const running = startFocus(IDLE, T0, S).state
    const r = advance(running, T0 + 10 * MIN, T0 + 5 * MIN, S)
    expect(r.state).toBe(running)
  })

  it('a break that ends during sleep just ends; the next focus starts now, not in the past', () => {
    const s = { ...S, autoStartFocus: true }
    const inBreak = advance(startFocus(IDLE, T0, s).state, T0 + 25 * MIN, T0 + 24 * MIN, s).state
    const wake = T0 + 2 * 60 * MIN
    const r = advance(inBreak, wake, T0 + 26 * MIN, s)
    expect(r.events.map((e) => e.type)).toEqual(['breakOver', 'focusStarted'])
    expect(r.state).toMatchObject({ phase: 'focus', endsAt: wake + 25 * MIN })
  })

  it('the clock going backwards keeps the end time', () => {
    const running = startFocus(IDLE, T0, S).state
    expect(advance(running, T0 - 30 * MIN, T0 - 31 * MIN, S).state).toBe(running)
  })
})

describe('remaining time for display', () => {
  it('rounds minutes up and is null when nothing is timed', () => {
    const running = startFocus(IDLE, T0, S).state
    expect(minutesLeft(running, T0)).toBe(25)
    expect(minutesLeft(running, T0 + 24 * MIN + 1)).toBe(1)
    expect(remainingMs(running, T0 + 30 * MIN)).toBe(0)
    expect(minutesLeft(pause(running, T0 + 10 * MIN).state, T0 + 99 * MIN)).toBe(15)
    expect(minutesLeft(IDLE, T0)).toBeNull()
  })
})

describe("today's count and history (FR-40, v4 FR-48/49)", () => {
  it('counts per local date; a new day starts at 0', () => {
    const today = localDate(T0)
    expect(today).toBe('2026-11-06')
    let h = addCompleted({ days: { [today]: 2 } }, T0, 1)
    expect(h).toEqual({ days: { '2026-11-06': 3 } })
    const tomorrow = new Date(2026, 10, 7, 0, 0, 1).getTime()
    expect(completedToday(h, tomorrow)).toBe(0)
    h = addCompleted(h, tomorrow, 1)
    expect(h.days).toEqual({ '2026-11-06': 3, '2026-11-07': 1 })
  })

  it('keeps only the last 30 days', () => {
    const h = addCompleted(
      { days: { '2026-10-07': 9, '2026-10-08': 4, '2030-01-01': 5 } },
      T0,
      1,
      30
    )
    // 2026-10-08 is 29 days before 2026-11-06: kept. Older and future dates are dropped.
    expect(h.days).toEqual({ '2026-10-08': 4, '2026-11-06': 1 })
  })

  it('lists the last 7 days oldest first, with zeros', () => {
    const week = lastDays({ days: { '2026-11-06': 3, '2026-11-02': 1, '2026-10-30': 8 } }, T0, 7)
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06'
    ])
    expect(week.map((d) => d.count)).toEqual([0, 0, 1, 0, 0, 0, 3])
  })

  it('crosses month ends and DST-free dates correctly', () => {
    const mar1 = new Date(2026, 2, 1, 9).getTime()
    expect(lastDays(EMPTY_HISTORY, mar1, 2).map((d) => d.date)).toEqual([
      '2026-02-28',
      '2026-03-01'
    ])
  })

  it('knows how long until midnight', () => {
    expect(msUntilMidnight(new Date(2026, 10, 6, 23, 59, 0).getTime())).toBe(MIN)
    expect(msUntilMidnight(new Date(2026, 10, 6, 0, 0, 0).getTime())).toBe(24 * 60 * MIN)
  })

  it('reads focus.json version 2 and upgrades version 1', () => {
    expect(parseFocusFile({ version: 2, days: { '2026-11-06': 4, '2026-11-05': 0 } })).toEqual({
      days: { '2026-11-06': 4, '2026-11-05': 0 }
    })
    expect(parseFocusFile({ version: 1, date: '2026-11-06', completed: 4 })).toEqual({
      days: { '2026-11-06': 4 }
    })
    expect(focusFileContent({ days: { '2026-11-06': 1 } })).toEqual({
      version: 2,
      days: { '2026-11-06': 1 }
    })
  })

  it('rejects damaged files', () => {
    expect(parseFocusFile({ version: 3, days: {} })).toBeNull()
    expect(parseFocusFile({ version: 2, days: { today: 1 } })).toBeNull()
    expect(parseFocusFile({ version: 2, days: { '2026-11-06': -1 } })).toBeNull()
    expect(parseFocusFile({ version: 2, days: [] })).toBeNull()
    expect(parseFocusFile({ version: 1, date: 'today', completed: 4 })).toBeNull()
    expect(parseFocusFile({ version: 1, date: '2026-11-06', completed: 1.5 })).toBeNull()
    expect(parseFocusFile('nope')).toBeNull()
  })
})
