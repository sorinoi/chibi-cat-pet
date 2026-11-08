import type { ClipName } from '../../shared/modelConfig'

/**
 * Pet behavior states. Each state plays the clip of the same name, except `welcome`
 * (the adoption scene, FR-23), which plays `pet` and then moves on to `happy`, and
 * `toWall` (walking to a screen edge to climb it, requirement-v5.md FR-76), which plays `walk`.
 */
export type PetState = ClipName | 'welcome' | 'toWall'

export function clipFor(state: PetState): ClipName {
  if (state === 'welcome') return 'pet'
  if (state === 'toWall') return 'walk'
  return state
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
  /** A treat (requirement-v4.md FR-52): eat, or happy when already full. */
  | 'treat'
  | 'treatFull'
  // v3 focus timer reactions (requirement-v3.md section 10)
  | 'cueFocusStart'
  | 'cueFocusDone'
  | 'cueBreakOver'
  | 'cueLongBreak'
  // v4 life (requirement-v4.md section 10)
  /** The wander timer chose the sad animation (FR-55). */
  | 'sadReminder'
  /** First wake of the morning (FR-58). */
  | 'morningStretch'
  /** A yawn at night instead of a wander (FR-59). */
  | 'nightYawn'
  /** The cursor came near the cat (FR-56). */
  | 'cursorNear'
  /** The cursor left the area around the cat. */
  | 'cursorAway'
  // v5 movement (requirement-v5.md section 10)
  /** Main started a fall on its own: start, shown again, displays changed (FR-63). */
  | 'fallStart'
  /** Main says the cat stands again after a drop or fall (FR-60). */
  | 'landed'
  /** Main started a jump chosen instead of a wander (FR-73, FR-75). */
  | 'jump'
  /** Main started a climb chosen instead of a wander: walking to the wall (FR-76). */
  | 'climbWander'
  /** Main started a hop run chosen instead of a wander (requirement-v8.md FR-114). */
  | 'hopRun'
  /** The cat reached the wall and climbs. */
  | 'atWall'
  /** The cat reached the top and holds on. */
  | 'holdPoint'

/** FR-63: any cat at rest or in a reaction may be found in the air and fall (wakes it too). */
const canFall = { fallStart: 'fall' } as const

/** Reactions that end in idle; a drag can still interrupt them. */
const careReaction = { clipFinished: 'idle', dragStart: 'drag', ...canFall } as const

/** Care actions that may start from a resting or moving pet (also wakes it: FR-21). */
const careActions = {
  feed: 'eat',
  refuseFood: 'click',
  pet: 'pet',
  welcome: 'welcome',
  treat: 'eat',
  treatFull: 'happy'
} as const

/** Focus timer reactions: may start from a resting, moving or landing pet (wakes it too). */
const focusCues = {
  cueFocusStart: 'focusStart',
  cueFocusDone: 'focusDone',
  cueBreakOver: 'breakOver',
  cueLongBreak: 'longBreak'
} as const

const TRANSITIONS: Record<PetState, Partial<Record<PetEvent, PetState>>> = {
  idle: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    wander: 'walk',
    hungryReminder: 'hungry',
    sadReminder: 'sad',
    morningStretch: 'stretch',
    nightYawn: 'yawn',
    cursorNear: 'look',
    sleep: 'sleep',
    jump: 'jump',
    climbWander: 'toWall',
    hopRun: 'hop',
    ...canFall,
    ...careActions,
    ...focusCues
  },
  walk: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    arrived: 'idle',
    sleep: 'sleep',
    ...canFall,
    ...careActions,
    ...focusCues
  },
  click: { clipFinished: 'idle', dragStart: 'drag', ...canFall },
  // FR-60: a drop always passes through fall; main answers landed at once when the cat is
  // already standing (or Gravity is off), so the v4 drag -> land feel stays.
  drag: { dragEnd: 'fall' },
  // FR-62: only a catch interrupts a fall; clicks, care, wanders and sleep wait for the landing.
  fall: { landed: 'land', dragStart: 'drag' },
  // FR-73..75, FR-77: a jump ends standing (land) or falling (off a perch, or the target was
  // lost, FR-74); only a catch interrupts it.
  jump: { landed: 'land', fallStart: 'fall', dragStart: 'drag' },
  // FR-76, FR-77: walk to the wall, climb, hold on, let go (fall). Only a catch interrupts;
  // a climb main ends early (hidden, resized) falls or, still on the floor, is just over.
  toWall: { atWall: 'climb', dragStart: 'drag', fallStart: 'fall', landed: 'idle' },
  climb: { holdPoint: 'hang', dragStart: 'drag', fallStart: 'fall', landed: 'land' },
  hang: { fallStart: 'fall', dragStart: 'drag', landed: 'land' },
  // requirement-v8.md FR-115: a hop run ends with landed; a catch or a fall interrupts it.
  hop: { dragStart: 'drag', fallStart: 'fall', landed: 'idle' },
  land: {
    clipFinished: 'idle',
    ...canFall,
    dragStart: 'drag',
    click: 'click',
    clickHappy: 'happy',
    welcome: 'welcome',
    ...focusCues
  },
  sleep: {
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    wake: 'idle',
    ...canFall,
    ...careActions,
    ...focusCues
  },
  // A care action during another care animation is ignored.
  eat: careReaction,
  happy: careReaction,
  hungry: careReaction,
  pet: careReaction,
  welcome: { clipFinished: 'happy', dragStart: 'drag', ...canFall },
  // Focus reactions behave like care reactions; another reaction during one waits (queued).
  focusStart: careReaction,
  focusDone: careReaction,
  breakOver: careReaction,
  longBreak: careReaction,
  // v4 life reactions (requirement-v4.md section 10); `look` gets its own rules in V4-M4.
  sad: careReaction,
  stretch: careReaction,
  yawn: careReaction,
  // FR-56: looking is a calm idle. Everything a resting cat reacts to still works; the
  // wander timer does not run, so the cat keeps looking until the cursor goes away.
  look: {
    cursorAway: 'idle',
    click: 'click',
    clickHappy: 'happy',
    dragStart: 'drag',
    sleep: 'sleep',
    ...canFall,
    ...careActions,
    ...focusCues
  }
}

/** Returns the next state, or null when the event does not apply in this state. */
export function transition(state: PetState, event: PetEvent): PetState | null {
  return TRANSITIONS[state][event] ?? null
}
