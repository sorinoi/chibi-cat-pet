/**
 * requirement-v6.md FR-80: turns focus timer steps into activity log items. Pure, unit tested.
 */
import type { ActivityItem, FocusActivityType } from '../../shared/activity'
import type { FocusSettings, TimerEvent, TimerState } from '../../shared/focusTimer'

type FocusItem = ActivityItem<FocusActivityType>

/** The user actions the focus engine takes (`check` is the timer itself). */
export type FocusAction = 'startFocus' | 'startBreak' | 'pause' | 'resume' | 'skip' | 'stop'

function minutesOf(phase: 'focus' | 'shortBreak' | 'longBreak', s: FocusSettings): number {
  if (phase === 'focus') return s.focusMinutes
  return phase === 'shortBreak' ? s.shortBreakMinutes : s.longBreakMinutes
}

/** Items for what the timer did in one step; `before` is the state the step started from. */
export function timerItems(
  before: TimerState,
  events: readonly TimerEvent[],
  s: FocusSettings
): FocusItem[] {
  return events.map((e): FocusItem => {
    switch (e.type) {
      case 'focusStarted':
        return { type: 'focus.started', data: { phase: 'focus', minutes: minutesOf('focus', s) } }
      case 'breakStarted':
        return { type: 'focus.started', data: { phase: e.phase, minutes: minutesOf(e.phase, s) } }
      case 'focusCompleted':
        return { type: 'focus.phaseEnded', data: { phase: 'focus', completed: true } }
      case 'focusInterrupted':
        return { type: 'focus.phaseEnded', data: { phase: 'focus', completed: false } }
      case 'breakOver': {
        const phase =
          before.kind === 'running' && before.phase !== 'focus' ? before.phase : 'shortBreak'
        return { type: 'focus.phaseEnded', data: { phase, completed: true } }
      }
    }
  })
}

/**
 * Items for a user action that the timer events do not show: pause, resume, skip and stop.
 * `before` is the state the action was taken in, `after` the state it led to; an action that
 * changed nothing reports nothing.
 */
export function actionItems(
  action: FocusAction,
  before: TimerState,
  after: TimerState
): FocusItem[] {
  if (after === before) return []
  switch (action) {
    case 'pause':
      return before.kind === 'running'
        ? [{ type: 'focus.paused', data: { phase: before.phase } }]
        : []
    case 'resume':
      return before.kind === 'paused'
        ? [{ type: 'focus.resumed', data: { phase: before.phase } }]
        : []
    case 'skip':
      return before.kind === 'idle'
        ? []
        : [{ type: 'focus.skipped', data: { phase: before.phase } }]
    case 'stop':
      return [
        {
          type: 'focus.stopped',
          data: {
            phase: before.kind === 'running' || before.kind === 'paused' ? before.phase : null
          }
        }
      ]
    case 'startFocus':
    case 'startBreak':
      return [] // shown by the timer's own started event
  }
}
