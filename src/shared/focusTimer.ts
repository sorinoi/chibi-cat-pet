/**
 * Pure focus-timer logic (requirement-v3.md section 4, NFR-18). No clocks, no I/O: callers
 * pass `now` (epoch ms) and the settings, so every rule is unit tested. Time comes from end
 * times on the wall clock, never from counting ticks.
 */
import { FOCUS, type FocusConfig } from './focusConfig'

export type FocusPhase = 'focus' | 'shortBreak' | 'longBreak'
export type BreakPhase = Exclude<FocusPhase, 'focus'>

export interface FocusSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}

/**
 * `run` counts focus sessions completed since the last long break or stop; it decides when
 * the long break comes.
 */
export type TimerState =
  | { kind: 'idle'; run: number }
  | { kind: 'running'; phase: FocusPhase; endsAt: number; run: number }
  | { kind: 'paused'; phase: FocusPhase; remainingMs: number; run: number }
  /** A break is due but waits for the user (autoStartBreaks off). */
  | { kind: 'waiting'; phase: BreakPhase; run: number }

/** Things that happened, for notifications and the cat's reactions (V3-M3). */
export type TimerEvent =
  | { type: 'focusStarted' }
  | { type: 'focusCompleted' }
  | { type: 'breakStarted'; phase: BreakPhase }
  | { type: 'breakOver' }
  | { type: 'focusInterrupted' }

export interface TimerStep {
  state: TimerState
  events: TimerEvent[]
  /** Completed focus sessions to add to today's count. */
  completed: number
}

const MINUTE_MS = 60_000

export const IDLE: TimerState = { kind: 'idle', run: 0 }

export function phaseMs(phase: FocusPhase, s: FocusSettings): number {
  const minutes =
    phase === 'focus'
      ? s.focusMinutes
      : phase === 'shortBreak'
        ? s.shortBreakMinutes
        : s.longBreakMinutes
  return minutes * MINUTE_MS
}

const step = (state: TimerState, events: TimerEvent[] = [], completed = 0): TimerStep => ({
  state,
  events,
  completed
})

function running(phase: FocusPhase, now: number, run: number, s: FocusSettings): TimerState {
  return { kind: 'running', phase, endsAt: now + phaseMs(phase, s), run }
}

/** The break after a focus: long every `longBreakEvery` completed sessions. */
function breakAfter(run: number, s: FocusSettings): BreakPhase {
  return run > 0 && run % s.longBreakEvery === 0 ? 'longBreak' : 'shortBreak'
}

/** Moves into the break after a focus (running, or waiting if breaks do not auto-start). */
function enterBreak(run: number, now: number, s: FocusSettings): TimerStep {
  const phase = breakAfter(run, s)
  if (!s.autoStartBreaks) return step({ kind: 'waiting', phase, run })
  return step(running(phase, now, run, s), [{ type: 'breakStarted', phase }])
}

/** After a break: a long break closes the run. Focus again, or idle, as configured. */
function leaveBreak(phase: BreakPhase, run: number, now: number, s: FocusSettings): TimerStep {
  const nextRun = phase === 'longBreak' ? 0 : run
  if (!s.autoStartFocus) return step({ kind: 'idle', run: nextRun })
  return step(running('focus', now, nextRun, s), [{ type: 'focusStarted' }])
}

/** Start focus: from idle, or from a waiting break (skipping it). */
export function startFocus(state: TimerState, now: number, s: FocusSettings): TimerStep {
  if (state.kind !== 'idle' && state.kind !== 'waiting') return step(state)
  const run = state.kind === 'waiting' && state.phase === 'longBreak' ? 0 : state.run
  return step(running('focus', now, run, s), [{ type: 'focusStarted' }])
}

/** Start the break that is waiting for the user. */
export function startBreak(state: TimerState, now: number, s: FocusSettings): TimerStep {
  if (state.kind !== 'waiting') return step(state)
  return step(running(state.phase, now, state.run, s), [
    { type: 'breakStarted', phase: state.phase }
  ])
}

export function pause(state: TimerState, now: number): TimerStep {
  if (state.kind !== 'running') return step(state)
  const remainingMs = Math.max(0, state.endsAt - now)
  return step({ kind: 'paused', phase: state.phase, remainingMs, run: state.run })
}

export function resume(state: TimerState, now: number): TimerStep {
  if (state.kind !== 'paused') return step(state)
  return step({
    kind: 'running',
    phase: state.phase,
    endsAt: now + state.remainingMs,
    run: state.run
  })
}

/**
 * Ends the current phase now without counting it and moves on as if it had ended. A skipped
 * focus does not count and does not advance the run.
 */
export function skip(state: TimerState, now: number, s: FocusSettings): TimerStep {
  if (state.kind === 'waiting') return leaveBreak(state.phase, state.run, now, s)
  if (state.kind !== 'running' && state.kind !== 'paused') return step(state)
  if (state.phase === 'focus') return enterBreak(state.run, now, s)
  return leaveBreak(state.phase, state.run, now, s)
}

/** Back to idle; the run restarts. Today's count is not touched. */
export function stop(state: TimerState): TimerStep {
  if (state.kind === 'idle' && state.run === 0) return step(state)
  return step(IDLE)
}

/**
 * Brings the state up to `now`. `lastSeen` is the previous check: a longer gap than
 * `maxSleepGapMs` during a focus means the PC slept, so that focus is interrupted (section 4).
 * The next phase starts at `now`, so a phase never starts and ends unseen during sleep.
 */
export function advance(
  state: TimerState,
  now: number,
  lastSeen: number,
  s: FocusSettings,
  c: FocusConfig = FOCUS
): TimerStep {
  if (state.kind !== 'running') return step(state)
  if (state.phase === 'focus' && now - lastSeen > c.maxSleepGapMs) {
    return step({ kind: 'idle', run: state.run }, [{ type: 'focusInterrupted' }])
  }
  if (now < state.endsAt) return step(state)
  if (state.phase === 'focus') {
    const run = state.run + 1
    const next = enterBreak(run, now, s)
    return step(next.state, [{ type: 'focusCompleted' }, ...next.events], 1)
  }
  const next = leaveBreak(state.phase, state.run, now, s)
  return step(next.state, [{ type: 'breakOver' }, ...next.events])
}

/** Remaining time of the current phase in ms (null when nothing is timed). */
export function remainingMs(state: TimerState, now: number): number | null {
  if (state.kind === 'running') return Math.max(0, state.endsAt - now)
  if (state.kind === 'paused') return state.remainingMs
  return null
}

/** Whole minutes left for display, rounded up ("1 min left" until the phase ends). */
export function minutesLeft(state: TimerState, now: number): number | null {
  const ms = remainingMs(state, now)
  return ms === null ? null : Math.ceil(ms / MINUTE_MS)
}

// --- Focus history (FR-40, requirement-v4.md FR-48) ------------------------------------

/** Completed focus sessions per local day ("YYYY-MM-DD" -> count). */
export interface FocusHistory {
  days: Record<string, number>
}

export const EMPTY_HISTORY: FocusHistory = { days: {} }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** Local calendar date of `now`, YYYY-MM-DD. */
export function localDate(now: number): string {
  const d = new Date(now)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local date `offset` calendar days from `now` (negative = earlier), DST-safe. */
function dateOffset(now: number, offset: number): string {
  const d = new Date(now)
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 12).getTime())
}

export function completedToday(history: FocusHistory, now: number): number {
  return history.days[localDate(now)] ?? 0
}

/** Adds to today and drops days older than `keepDays` (today counts as one). */
export function addCompleted(
  history: FocusHistory,
  now: number,
  count: number,
  keepDays: number = FOCUS.historyKeepDays
): FocusHistory {
  const today = localDate(now)
  const oldest = dateOffset(now, -(keepDays - 1))
  const days: Record<string, number> = {}
  for (const [date, n] of Object.entries(history.days))
    if (date >= oldest && date <= today) days[date] = n
  days[today] = (days[today] ?? 0) + count
  return { days }
}

export interface DayCount {
  date: string
  count: number
}

/** The last `n` days ending today, oldest first, with 0 for days without focus (FR-49). */
export function lastDays(history: FocusHistory, now: number, n: number): DayCount[] {
  return Array.from({ length: n }, (_, i) => {
    const date = dateOffset(now, i - (n - 1))
    return { date, count: history.days[date] ?? 0 }
  })
}

/** Milliseconds until the next local midnight (when the count resets). */
export function msUntilMidnight(now: number): number {
  const d = new Date(now)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return next.getTime() - now
}

/**
 * Validates focus.json; null when it is unusable. Version 1 (v3: one day) is upgraded to the
 * version 2 history (FR-48).
 */
export function parseFocusFile(raw: unknown): FocusHistory | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r['version'] === 1) {
    const { date, completed } = r
    if (typeof date !== 'string' || !DATE_RE.test(date) || !isCount(completed)) return null
    return { days: { [date]: completed } }
  }
  if (r['version'] !== 2) return null
  const daysRaw = r['days']
  if (typeof daysRaw !== 'object' || daysRaw === null || Array.isArray(daysRaw)) return null
  const days: Record<string, number> = {}
  for (const [date, n] of Object.entries(daysRaw)) {
    if (!DATE_RE.test(date) || !isCount(n)) return null
    days[date] = n
  }
  return { days }
}

/** What focus.json stores (version 2). */
export function focusFileContent(history: FocusHistory): {
  version: 2
  days: Record<string, number>
} {
  return { version: 2, days: history.days }
}
