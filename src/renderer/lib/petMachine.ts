import type { ClipName } from '../../shared/modelConfig'

/**
 * Pet behavior states. Each state plays the clip of the same name, except `welcome`
 * (the adoption scene, FR-23), which plays `pet` and then moves on to `happy`.
 */
export type PetState = ClipName | 'welcome'

export function clipFor(state: PetState): ClipName {
  return state === 'welcome' ? 'pet' : state
}

export type PetEvent =
  | 'click'
  | 'dragStart'
  | 'dragEnd'
  | 'clipFinished'
  | 'wander'
  | 'arrived'
  | 'sleep'
  | 'wake'
  // v2 care (requirement-v2.md section 10)
  /** Click on a happy pet that plays `happy` instead of `click`. */
  | 'clickHappy'
  /** Fed and not full. */
  | 'feed'
  /** Fed while full: plays the click reaction instead of eating. */
  | 'refuseFood'
  | 'pet'
  /** The wander timer chose the hungry reminder. */
  | 'hungryReminder'
  /** Just adopted (FR-23). */
  | 'welcome'

/** Reactions that end in idle; a drag can still interrupt them. */
const careReaction = { clipFinished: 'idle', dragStart: 'drag' } as const

/** Care actions that may start from a resting or moving pet (also wakes it: FR-21). */
const careActions = { feed: 'eat', refuseFood: 'click', pet: 'pet', welcome: 'welcome' } as const

const TRANSITIONS: Record<PetState, Partial<Record<PetEvent, PetState>>> = {
  idle: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    wander: 'walk',
    hungryReminder: 'hungry',
    sleep: 'sleep',
    ...careActions
  },
  walk: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    arrived: 'idle',
    sleep: 'sleep',
    ...careActions
  },
  click: { clipFinished: 'idle', dragStart: 'drag' },
  drag: { dragEnd: 'land' },
  land: {
    clipFinished: 'idle',
    dragStart: 'drag',
    click: 'click',
    clickHappy: 'happy',
    welcome: 'welcome'
  },
  sleep: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    wake: 'idle',
    ...careActions
  },
  // A care action during another care animation is ignored.
  eat: careReaction,
  happy: careReaction,
  hungry: careReaction,
  pet: careReaction,
  welcome: { clipFinished: 'happy', dragStart: 'drag' }
}

/** Returns the next state, or null when the event does not apply in this state. */
export function transition(state: PetState, event: PetEvent): PetState | null {
  return TRANSITIONS[state][event] ?? null
}
