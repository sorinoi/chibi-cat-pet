import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { writeJsonAtomic } from './lib/jsonFile'
import type { FocusView } from '../shared/focusText'
import { FOCUS, type FocusConfig } from '../shared/focusConfig'
import {
  IDLE,
  addCompleted,
  advance,
  completedToday,
  EMPTY_HISTORY,
  focusFileContent,
  lastDays,
  minutesLeft,
  msUntilMidnight,
  parseFocusFile,
  pause,
  resume,
  skip,
  startBreak,
  startFocus,
  stop,
  type DayCount,
  type FocusHistory,
  type FocusSettings,
  type TimerEvent,
  type TimerState,
  type TimerStep
} from '../shared/focusTimer'

export interface FocusSnapshot {
  state: TimerState
  /** Whole minutes left in the current phase (rounded up); null when nothing is timed. */
  minutesLeft: number | null
  /** Focus sessions completed today (FR-36, FR-40). */
  completedToday: number
  /** The last days, oldest first (requirement-v4.md FR-49). */
  week: DayCount[]
}

/** The part of a snapshot the windows and menus show (FR-35, FR-36). */
export function toFocusView({
  state,
  minutesLeft,
  completedToday,
  week
}: FocusSnapshot): FocusView {
  return {
    kind: state.kind,
    phase: state.kind === 'idle' ? null : state.phase,
    minutesLeft,
    completedToday,
    week
  }
}

export type FocusFileStatus = 'missing' | 'ok' | 'damaged'

export interface FocusEngine {
  /** Reads focus.json (history; a v3 file is upgraded). A damaged file is moved to focus.json.bad. */
  load(): FocusFileStatus
  current(): FocusSnapshot
  startFocus(): void
  /** Starts a break that waits for the user (autoStartBreaks off). */
  startBreak(): void
  pause(): void
  resume(): void
  skip(): void
  stop(): void
  /** Brings the timer up to date now, e.g. after the PC wakes up. */
  check(): void
  /** Called after every change and once a minute while a phase runs (for tooltips). */
  onChange(listener: (snapshot: FocusSnapshot, events: TimerEvent[]) => void): void
  dispose(): void
}

export interface FocusEngineOptions {
  filePath: string
  /** Read on every step, so changed settings apply to the next phase (FR-39). */
  settings: () => FocusSettings
  now?: () => number
  config?: FocusConfig
}

/**
 * Owns the focus timer in the main process (requirement-v3.md section 4). No Electron imports,
 * so it is unit tested with a temp folder and a fake clock. One timeout waits for the next
 * phase end and one interval refreshes tooltips while a phase runs; nothing runs while idle
 * except the midnight reset (NFR-16). Sessions are not saved: quitting ends them.
 */
export function createFocusEngine({
  filePath,
  settings,
  now = () => Date.now(),
  config = FOCUS
}: FocusEngineOptions): FocusEngine {
  let state: TimerState = IDLE
  let history: FocusHistory = EMPTY_HISTORY
  let lastSeen = now()
  let phaseTimer: ReturnType<typeof setTimeout> | null = null
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let midnightTimer: ReturnType<typeof setTimeout> | null = null
  const listeners: Array<(snapshot: FocusSnapshot, events: TimerEvent[]) => void> = []

  function snapshot(): FocusSnapshot {
    const t = now()
    return {
      state,
      minutesLeft: minutesLeft(state, t),
      completedToday: completedToday(history, t),
      week: lastDays(history, t, config.historyShownDays)
    }
  }

  function emit(events: TimerEvent[]): void {
    const s = snapshot()
    listeners.forEach((fn) => fn(s, events))
  }

  function save(): void {
    try {
      writeJsonAtomic(filePath, focusFileContent(history))
    } catch (err) {
      console.error('Failed to save focus count:', err)
    }
  }

  /** Timers follow the state: one timeout to the phase end, a tick only while running. */
  function schedule(): void {
    if (phaseTimer) clearTimeout(phaseTimer)
    phaseTimer = null
    if (state.kind === 'running') {
      phaseTimer = setTimeout(check, Math.max(0, state.endsAt - now()))
      if (!tickTimer) tickTimer = setInterval(check, config.tickIntervalMs)
    } else if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  function scheduleMidnight(): void {
    if (midnightTimer) clearTimeout(midnightTimer)
    // A little past midnight, so the new date is certain.
    midnightTimer = setTimeout(
      () => {
        emit([])
        scheduleMidnight()
      },
      msUntilMidnight(now()) + 1_000
    )
  }

  /** Applies steps taken at `t`; saves when today's count changed. */
  function apply(t: number, steps: TimerStep[]): TimerEvent[] {
    const events: TimerEvent[] = []
    for (const s of steps) {
      state = s.state
      events.push(...s.events)
      if (s.completed > 0) {
        history = addCompleted(history, t, s.completed, config.historyKeepDays)
        save()
      }
    }
    lastSeen = t
    schedule()
    return events
  }

  function check(): void {
    const t = now()
    emit(apply(t, [advance(state, t, lastSeen, settings(), config)]))
  }

  /** A user action: first catch up (a phase may have ended, or the PC slept), then act. */
  function act(fn: (current: TimerState, t: number, s: FocusSettings) => TimerStep): void {
    const t = now()
    const s = settings()
    const caughtUp = advance(state, t, lastSeen, s, config)
    emit(apply(t, [caughtUp, fn(caughtUp.state, t, s)]))
  }

  return {
    load() {
      scheduleMidnight()
      if (!existsSync(filePath)) return 'missing'
      let parsed: FocusHistory | null = null
      try {
        parsed = parseFocusFile(JSON.parse(readFileSync(filePath, 'utf8')) as unknown)
      } catch {
        parsed = null
      }
      if (parsed) {
        history = parsed
        return 'ok'
      }
      const movedTo = `${filePath}.bad`
      rmSync(movedTo, { force: true })
      renameSync(filePath, movedTo)
      console.warn(`focus.json was damaged; moved to ${movedTo}`)
      return 'damaged'
    },
    current: snapshot,
    startFocus: () => act((st, t, s) => startFocus(st, t, s)),
    startBreak: () => act((st, t, s) => startBreak(st, t, s)),
    pause: () => act((st, t) => pause(st, t)),
    resume: () => act((st, t) => resume(st, t)),
    skip: () => act((st, t, s) => skip(st, t, s)),
    stop: () => act((st) => stop(st)),
    check,
    onChange(listener) {
      listeners.push(listener)
    },
    dispose() {
      if (phaseTimer) clearTimeout(phaseTimer)
      if (tickTimer) clearInterval(tickTimer)
      if (midnightTimer) clearTimeout(midnightTimer)
      phaseTimer = tickTimer = midnightTimer = null
      listeners.length = 0
    }
  }
}
