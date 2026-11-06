/**
 * Focus timer status, notifications and cat reactions as pure functions
 * (requirement-v3.md sections 5-6), shared by main (tray, notifications) and the pet window.
 */
import type { BreakPhase, DayCount, FocusPhase, FocusSettings, TimerEvent } from './focusTimer'
import type { Strings } from './strings'

/** What the windows need to know about the timer (sent over IPC). */
export interface FocusView {
  kind: 'idle' | 'running' | 'paused' | 'waiting'
  /** null when idle. */
  phase: FocusPhase | null
  /** Whole minutes left, rounded up; null when nothing is timed. */
  minutesLeft: number | null
  completedToday: number
  /** The last days, oldest first (requirement-v4.md FR-49). */
  week: DayCount[]
}

/** Phase line: "Focus · 12 min left", "Paused (Focus) · 8 min left", "Short break is ready". */
export function focusPhaseLine(view: FocusView, text: Strings): string | null {
  const t = text.focus
  if (view.kind === 'idle' || !view.phase) return null
  const phase = t.phases[view.phase]
  if (view.kind === 'waiting') return t.waiting(phase)
  const minutes = view.minutesLeft ?? 0
  return view.kind === 'paused' ? t.paused(phase, minutes) : t.running(phase, minutes)
}

/** Tooltip line (FR-36): phase and minutes left, then today's count. */
export function focusStatus(view: FocusView, text: Strings): string {
  const today = text.focus.today(view.completedToday)
  const phase = focusPhaseLine(view, text)
  return phase ? `${phase}${text.care.separator}${today}` : today
}

export interface FocusNotice {
  title: string
  body: string
}

/** The Windows notification for this step, or null when it needs none (FR-37). */
export function focusNotice(
  events: readonly TimerEvent[],
  /** The timer after the step (tells which break waits). */
  view: FocusView,
  settings: Pick<FocusSettings, 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'>,
  text: Strings
): FocusNotice | null {
  const t = text.focus
  const has = (type: TimerEvent['type']): boolean => events.some((e) => e.type === type)
  const breakMinutes = (phase: BreakPhase): number =>
    phase === 'longBreak' ? settings.longBreakMinutes : settings.shortBreakMinutes

  if (has('focusInterrupted')) {
    return { title: t.notify.interruptedTitle, body: t.notify.interrupted }
  }
  if (has('focusCompleted')) {
    const started = events.find((e) => e.type === 'breakStarted')
    if (started && started.type === 'breakStarted') {
      return {
        title: t.notify.focusDoneTitle,
        body: t.notify.focusDoneBreak(t.phases[started.phase], breakMinutes(started.phase))
      }
    }
    if (view.kind === 'waiting' && view.phase) {
      return {
        title: t.notify.focusDoneTitle,
        body: t.notify.focusDoneWaiting(t.phases[view.phase])
      }
    }
    return null
  }
  if (has('breakOver')) {
    return {
      title: t.notify.breakOverTitle,
      body: has('focusStarted')
        ? t.notify.breakOverFocus(settings.focusMinutes)
        : t.notify.breakOverIdle
    }
  }
  return null
}

/** Cat reactions at phase changes (section 5). */
export type FocusReaction = 'focusStart' | 'focusDone' | 'breakOver' | 'longBreak'

/** At most one reaction per step; the most meaningful moment wins. */
export function focusReaction(events: readonly TimerEvent[]): FocusReaction | null {
  const has = (type: TimerEvent['type']): boolean => events.some((e) => e.type === type)
  if (has('focusCompleted')) {
    const long = events.some((e) => e.type === 'breakStarted' && e.phase === 'longBreak')
    return long ? 'longBreak' : 'focusDone'
  }
  if (has('breakOver')) return 'breakOver'
  if (has('focusStarted')) return 'focusStart'
  return null
}
