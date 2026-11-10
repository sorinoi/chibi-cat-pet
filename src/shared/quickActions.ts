import { ACTION_IDS, type ActionId } from './ipc'
import type { FocusView } from './focusText'
import type { Strings } from './strings'

/**
 * requirement-v9.md FR-128, FR-129, FR-132: which picture a button shows. The Focus button
 * follows the timer: the main action of its state, like the first item of the Focus menu.
 */
export type ActionVariant =
  'feed' | 'focusStart' | 'focusPause' | 'focusResume' | 'focusStartBreak' | 'settings' | 'hide'

export interface ActionButton {
  id: ActionId
  variant: ActionVariant
  /** FR-127: shown next to the button while the pointer is on it. */
  label: string
}

const FOCUS_VARIANT: Record<FocusView['kind'], ActionVariant> = {
  idle: 'focusStart',
  running: 'focusPause',
  paused: 'focusResume',
  waiting: 'focusStartBreak'
}

/** The buttons to show, left to right. Feed only when a cat is adopted (FR-128). */
export function actionButtons(
  hasPet: boolean,
  focusKind: FocusView['kind'],
  text: Strings
): ActionButton[] {
  const focusLabel: Record<FocusView['kind'], string> = {
    idle: text.focus.startFocus,
    running: text.focus.pause,
    paused: text.focus.resume,
    waiting: text.focus.startBreak
  }
  const all: Record<ActionId, ActionButton> = {
    feed: { id: 'feed', variant: 'feed', label: text.actions.feed },
    focus: { id: 'focus', variant: FOCUS_VARIANT[focusKind], label: focusLabel[focusKind] },
    settings: { id: 'settings', variant: 'settings', label: text.actions.settings },
    hide: { id: 'hide', variant: 'hide', label: text.actions.hide }
  }
  return ACTION_IDS.filter((id) => hasPet || id !== 'feed').map((id) => all[id])
}

/**
 * requirement-v9.md FR-133: the buttons' motion. Shared because main waits for the hide
 * animation before it hides the window.
 */
export const ACTION_MOTION = {
  /** Each button grows out of the cat this long, the next one this much later. */
  appearMs: 220,
  staggerMs: 40,
  /** All buttons shrink back into the cat together. */
  hideMs: 150,
  /**
   * Bobbing while shown: up and down by this many DIP, once per period. A timer moves the
   * buttons bobFps times a second in bobStepDip steps and repaints only on a change (NFR-50:
   * a 60 fps CSS animation cost about 28 % of one core while shown).
   */
  bobDip: 3,
  bobPeriodMs: 2000,
  bobFps: 12,
  bobStepDip: 0.5,
  /** The button under the pointer grows a little. */
  hoverScale: 1.12,
  /** Size at the start of the appear and the end of the hide. */
  startScale: 0.2
} as const

/** FR-129: what a click on the Focus button does in each timer state. */
export type FocusCommand = 'startFocus' | 'pause' | 'resume' | 'startBreak'

export function focusCommand(focusKind: FocusView['kind']): FocusCommand {
  switch (focusKind) {
    case 'idle':
      return 'startFocus'
    case 'running':
      return 'pause'
    case 'paused':
      return 'resume'
    case 'waiting':
      return 'startBreak'
  }
}
