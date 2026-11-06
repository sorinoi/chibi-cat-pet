/**
 * Focus timer defaults, limits and internals in one place (requirement-v3.md section 4,
 * NFR-19). Defaults follow the classic Pomodoro method.
 */
export const FOCUS = {
  defaults: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    /** A long break follows every Nth completed focus in a run. */
    longBreakEvery: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    focusNotifications: true
  },
  limits: {
    focusMinutes: { min: 1, max: 120, step: 1 },
    shortBreakMinutes: { min: 1, max: 60, step: 1 },
    longBreakMinutes: { min: 1, max: 60, step: 1 },
    longBreakEvery: { min: 2, max: 10, step: 1 }
  },
  /**
   * A gap this long between two checks means the PC slept or the app froze; a focus phase
   * running through it is interrupted (not counted).
   */
  maxSleepGapMs: 5 * 60_000,
  /** Days of focus history kept in focus.json (requirement-v4.md FR-48). */
  historyKeepDays: 30,
  /** Days shown as bars in settings (FR-49). */
  historyShownDays: 7,
  /** How often a running phase refreshes tooltips and notices sleep gaps (NFR-16). */
  tickIntervalMs: 60_000
} as const

export type FocusConfig = typeof FOCUS
