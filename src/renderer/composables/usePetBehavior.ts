import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'
import { BEHAVIOR } from '../config'
import { clickReaction, idleAction, wanderDelayMs, type CareMood } from '../lib/careBehavior'
import { clipFor, transition, type PetEvent, type PetState } from '../lib/petMachine'
import type { PetScene } from './usePetScene'
import { resolveClip, type ClipName } from '../../shared/modelConfig'
import type { CareRequest, CareView } from '../../shared/ipc'
import type { FocusReaction } from '../../shared/focusText'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import type { ActivityLevel } from '../../shared/settings'
import { localDate } from '../../shared/focusTimer'
import { isNight, morningStretchDue } from '../../shared/timeOfDay'
import { lookSide } from '../lib/lookLogic'
import type { CursorNear } from '../../shared/ipc'

export interface PetBehavior {
  state: Readonly<Ref<PetState>>
  /** Care status from main (null = no pet yet), for the tooltip (FR-27). */
  care: Readonly<Ref<CareView | null>>
  dispatch(event: PetEvent): void
  /** A click on the cat (FR-03, FR-20): reaction depends on the mood; counts the bonus. */
  click(): void
  /** A recognized stroke (FR-18): plays pet and counts the bonus. */
  stroke(): void
  /** requirement-v9.md FR-120: whether a pointer resting on the cat may open the buttons. */
  canOpenActions(): boolean
  /** FR-120: the pointer rested on the cat; ask main to show the quick buttons. */
  openActions(): void
  /** FR-121: hide the quick buttons now (right-click). */
  closeActions(): void
  /** FR-121: the pointer moved on or off the cat. */
  pointerOnPet(over: boolean): void
}

export interface PetBehaviorOptions {
  /** Whether the pointer is on the cat now (requirement-v9.md FR-122: the cat waits). */
  pointerOnPet(): boolean
}

/** requirement-v9.md FR-120: states in which a resting pointer opens the quick buttons. */
const REST_STATES: ReadonlySet<PetState> = new Set<PetState>(['idle', 'look', 'sleep'])

/** Focus timer reaction -> state machine event (requirement-v3.md section 10). */
const FOCUS_CUE: Record<FocusReaction, PetEvent> = {
  focusStart: 'cueFocusStart',
  focusDone: 'cueFocusDone',
  breakOver: 'cueBreakOver',
  longBreak: 'cueLongBreak'
}

/** States in which main moves the cat on its own; care waits until it stands (FR-62, FR-77). */
const MOVING: ReadonlySet<PetState> = new Set<PetState>([
  'fall',
  'jump',
  'toWall',
  'climb',
  'hang',
  'hop'
])

/** Optional clips play only when the model has them (no fallback for sad and yawn). */
const hasClip = (clip: ClipName): boolean => ACTIVE_MODEL.clips[clip] !== undefined

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

/**
 * Drives the pet state machine: plays the matching clip on every state change,
 * schedules wandering (FR-06), sleeps while the user is away (FR-07), asks the main
 * process to move the window for walk and drag, and reacts to care (requirement-v2.md
 * sections 5-6). The care mood comes from main; null means no pet is adopted yet.
 */
export function usePetBehavior(scene: PetScene, options: PetBehaviorOptions): PetBehavior {
  const api = window.petApi
  const state = ref<PetState>('idle')
  const careView = ref<CareView | null>(null)
  let wanderTimer: ReturnType<typeof setTimeout> | null = null
  let userIdle = false
  let mood: CareMood = null
  /** Last hungry or sad reminder (section 5, requirement-v4.md FR-55). */
  let lastMoodReminderAt: number | null = null
  /** Date of the last morning stretch, YYYY-MM-DD (FR-58). */
  let lastStretchDate: string | null = null
  /** Whether main is sending cursor updates (FR-57). */
  let lookWatching = false
  /** The pending care:act request for a Feed or treat from a menu (main decides the reaction). */
  let careInFlight: ReturnType<typeof api.careAct> | null = null
  /** A focus reaction that arrived during another reaction; plays on the next idle. */
  let queuedCue: PetEvent | null = null
  /** A menu care request that arrived mid-fall or mid-jump; handled once the cat stands. */
  let pendingCare: CareRequest | null = null
  /** Last jump or climb (requirement-v5.md NFR-30 cooldown, shared). */
  let lastMoveAt: number | null = null
  const unsubscribers: Array<() => void> = []
  /**
   * requirement-v9.md: whether main shows the quick buttons. It mirrors the buttons window, not
   * the cat's behavior (that is the `attend` state, which an asleep cat skips).
   */
  let actionsShown = false
  /** requirement-v8.md FR-117: Calm, Normal or Lively (main tells; Normal until then). */
  let activity: ActivityLevel = 'normal'
  const level = (): (typeof BEHAVIOR.activity)[ActivityLevel] => BEHAVIOR.activity[activity]

  function clearWander(): void {
    if (wanderTimer) clearTimeout(wanderTimer)
    wanderTimer = null
  }

  /** The wander timer: walk, or show the hungry reminder instead (section 5). */
  function onWanderTimer(): void {
    // Do not walk or nag while hidden from the tray or by a fullscreen app, and wait while the
    // pointer rests on the cat (requirement-v9.md FR-122).
    if (document.hidden || options.pointerOnPet()) {
      scheduleWander()
      return
    }
    const now = Date.now()
    const action = idleAction(mood, now, lastMoodReminderAt, undefined, {
      canSad: hasClip('sad'),
      nightYawn: isNight(now) && hasClip('yawn'),
      random: Math.random()
    })
    if (action === 'hungry' || action === 'sad') lastMoodReminderAt = now
    if (action === 'hungry') dispatch('hungryReminder')
    else if (action === 'sad') dispatch('sadReminder')
    else if (action === 'yawn') dispatch('nightYawn')
    else if (moveDue('jump', now)) void tryJump()
    else if (moveDue('climb', now)) void tryClimb()
    else if (hopDue(now)) void tryHop()
    else dispatch('wander')
  }

  /**
   * FR-73, FR-75, FR-76, NFR-30: now and then a wander becomes a jump or climb attempt,
   * with one cooldown for both.
   */
  function moveDue(kind: 'jump' | 'climb', now: number): boolean {
    if (!hasClip(kind)) return false
    const { cooldownMs } = BEHAVIOR.jump
    if (lastMoveAt !== null && now - lastMoveAt < cooldownMs) return false
    return Math.random() < BEHAVIOR[kind].chance
  }

  /** requirement-v8.md FR-114, NFR-48: a wander becomes a hop run by the Activity level's chance. */
  let lastHopAt: number | null = null
  function hopDue(now: number): boolean {
    if (!hasClip('hop')) return false
    if (lastHopAt !== null && now - lastHopAt < BEHAVIOR.hop.minIntervalMs) return false
    return Math.random() < level().hopChance
  }

  /** Main hops the cat along if there is room; otherwise it wanders. */
  async function tryHop(): Promise<void> {
    const { count, distance } = BEHAVIOR.hop
    const started = await api.startHops({
      count: Math.round(randomBetween(count.min, count.max)),
      distance: randomBetween(distance.min, distance.max),
      roll: Math.random()
    })
    if (state.value !== 'idle') {
      if (started) api.stopHops()
      return
    }
    if (!started) {
      dispatch('wander')
      return
    }
    lastHopAt = Date.now()
    scene.setFacing(started.direction > 0 ? 'right' : 'left')
    dispatch('hopRun')
  }

  /** Main walks the cat to a screen edge and climbs if it fits; otherwise it wanders. */
  async function tryClimb(): Promise<void> {
    const started = await api.startClimb()
    if (state.value !== 'idle') {
      if (started) api.stopClimb()
      return
    }
    if (!started) {
      dispatch('wander')
      return
    }
    lastMoveAt = Date.now()
    scene.setFacing(started.side)
    dispatch('climbWander')
  }

  /** Main jumps if one fits; otherwise the cat wanders as usual. */
  async function tryJump(): Promise<void> {
    const started = await api.startJump()
    if (state.value !== 'idle') {
      // Clicked, dragged or put to sleep while main was planning.
      if (started) api.stopJump()
      return
    }
    if (!started) {
      dispatch('wander')
      return
    }
    lastMoveAt = Date.now()
    if (started.dx !== 0) scene.setFacing(started.dx > 0 ? 'right' : 'left')
    dispatch('jump')
  }

  function scheduleWander(): void {
    clearWander()
    wanderTimer = setTimeout(
      onWanderTimer,
      wanderDelayMs(mood, level().wanderDelaySeconds, Math.random())
    )
  }

  async function startWalk(): Promise<void> {
    const { min, max } = level().walkDistance
    // FR-111: main picks the direction toward the side with more room.
    const planned = await api.startWalk({
      dx: randomBetween(min, max),
      speed: BEHAVIOR.walkSpeed,
      roll: Math.random()
    })
    if (state.value !== 'walk') {
      // Interrupted (click, drag, sleep) while the request was in flight.
      if (planned !== 0) api.stopWalk()
      return
    }
    if (planned === 0) {
      dispatch('arrived')
      return
    }
    scene.setFacing(planned > 0 ? 'right' : 'left')
  }

  function exit(from: PetState, to: PetState): void {
    if (from === 'idle') clearWander()
    if (from === 'walk' && to !== 'idle') api.stopWalk()
    // requirement-v5.md FR-60: letting go is a drop; main falls or answers landed at once.
    if (from === 'drag') api.endDrag()
  }

  /** Same picture before and after (drag -> fall without fall art): keep the clip running. */
  const sameClip = (a: PetState, b: PetState): boolean =>
    resolveClip(clipFor(a), ACTIVE_MODEL.clips) === resolveClip(clipFor(b), ACTIVE_MODEL.clips)

  function enter(to: PetState, from?: PetState): void {
    // The hungry reminder is a looping clip; play it once (intro + one loop).
    if (!(from === 'drag' && to === 'fall' && sameClip(from, to))) {
      scene.play(clipFor(to), to === 'hungry' ? { once: true } : undefined)
    }

    switch (to) {
      case 'idle':
        if (pendingCare) {
          const request = pendingCare
          pendingCare = null
          onCareRequest(request)
          if (state.value !== 'idle') break
        }
        if (queuedCue) {
          const cue = queuedCue
          queuedCue = null
          dispatch(cue)
          break
        }
        // The user may have gone away during a reaction; sleep right away then.
        if (userIdle) dispatch('sleep')
        else scheduleWander()
        break
      case 'walk':
        void startWalk()
        break
      case 'drag':
        api.startDrag()
        break
      default:
        break
    }
  }

  function dispatch(event: PetEvent): void {
    const from = state.value
    const to = transition(from, event)
    if (!to) return
    state.value = to
    exit(from, to)
    enter(to, from)
    syncLookWatch()
    if (actionsShown) keepOrCloseActions(from, to)
  }

  /**
   * requirement-v9.md FR-121: any change of what the cat does hides the buttons, except opening
   * them (attend) and waking up under them (the cat then waits again).
   */
  function keepOrCloseActions(from: PetState, to: PetState): void {
    if (to === 'attend') return
    if (from === 'sleep' && to === 'idle') {
      dispatch('actionsOpen')
      return
    }
    closeActions()
  }

  function closeActions(): void {
    if (!actionsShown) return
    actionsShown = false
    api.closeActions()
  }

  const canOpenActions = (): boolean =>
    !actionsShown && !document.hidden && REST_STATES.has(state.value)

  /** FR-120: main shows the buttons around the cat's art if it can. */
  async function openActions(): Promise<void> {
    if (!canOpenActions()) return
    const art = scene.artBox()
    if (!art) return
    actionsShown = true
    const shown = await api.openActions(art)
    if (!actionsShown) return // closed while main was answering
    if (!shown) {
      actionsShown = false
      return
    }
    // An asleep cat stays asleep under the buttons; a resting one waits (FR-122).
    dispatch('actionsOpen')
  }

  /**
   * FR-57 / NFR-21: cursor updates only while the cat could look: a cat exists, the
   * model has the `look` clip, the window is visible and the cat is idle or looking.
   */
  function syncLookWatch(): void {
    const want =
      hasClip('look') &&
      mood !== null &&
      !document.hidden &&
      (state.value === 'idle' || state.value === 'look')
    if (want === lookWatching) return
    lookWatching = want
    api.setLookWatch(want)
  }

  /** FR-56: look toward a nearby cursor, mirrored for the left side; stop when it leaves. */
  function onCursor(position: CursorNear): void {
    if (state.value !== 'idle' && state.value !== 'look') return
    const side = lookSide({ ...position, overPet: scene.hitTest(position.x, position.y) })
    if (state.value === 'idle') {
      if (!side) return
      scene.setFacing(side)
      dispatch('cursorNear')
    } else if (!side) {
      dispatch('cursorAway')
    } else {
      scene.setFacing(side)
    }
  }

  scene.onClipFinished((clip) => {
    if (clip === clipFor(state.value)) dispatch('clipFinished')
    // A one-off clip outside the state machine (dev preview): go back to the state's clip.
    else scene.play(clipFor(state.value))
  })

  function click(): void {
    const event: PetEvent = clickReaction(mood, Math.random()) === 'happy' ? 'clickHappy' : 'click'
    // The bonus counts only when the click reaction actually plays.
    const plays = transition(state.value, event) !== null
    dispatch(event)
    if (plays && mood !== null) void api.careAct('click')
  }

  /** Petting (stroke or menu): only for an adopted pet, and not during another reaction. */
  function petNow(): void {
    if (mood === null || !transition(state.value, 'pet')) return
    dispatch('pet')
    void api.careAct('pet')
  }

  /** Feeding from a menu: main says whether the pet ate or was too full (FR-17). */
  async function feedNow(): Promise<void> {
    // A second Feed while main is still answering the first must not feed twice.
    if (careInFlight || mood === null || !transition(state.value, 'feed')) return
    careInFlight = api.careAct('feed')
    try {
      const result = await careInFlight
      // A drag in the meantime interrupts the reaction; the meal still counts (section 6).
      if (result) dispatch(result.refused ? 'refuseFood' : 'feed')
    } finally {
      careInFlight = null
    }
  }

  /**
   * FR-38: react to a focus phase change. Skipped while hidden, dragged or without a pet;
   * during another reaction it waits (at most one queued, the latest wins).
   */
  function onFocusReaction(reaction: FocusReaction): void {
    if (mood === null || document.hidden || state.value === 'drag') return
    const cue = FOCUS_CUE[reaction]
    if (transition(state.value, cue)) dispatch(cue)
    else queuedCue = cue
  }

  /** A treat from a menu (FR-52): main gives it and says whether the cat was full. */
  async function treatNow(): Promise<void> {
    if (careInFlight || mood === null || !transition(state.value, 'treat')) return
    careInFlight = api.careAct('treat')
    try {
      const result = await careInFlight
      if (result) dispatch(result.full ? 'treatFull' : 'treat')
    } finally {
      careInFlight = null
    }
  }

  /** FR-58: the first wake of a morning (app start or the user is back) plays a stretch. */
  function maybeMorningStretch(): void {
    const now = Date.now()
    if (mood === null || userIdle || document.hidden || state.value !== 'idle') return
    if (!morningStretchDue(now, lastStretchDate)) return
    lastStretchDate = localDate(now)
    dispatch('morningStretch')
  }

  function onCareRequest(request: CareRequest): void {
    // FR-62, FR-77: care waits for the landing (the welcome scene after adoption too).
    if (MOVING.has(state.value)) {
      pendingCare = request
      return
    }
    if (request === 'treat') void treatNow()
    else if (request === 'feed') void feedNow()
    else if (request === 'pet') petNow()
    else dispatch('welcome') // FR-23: just adopted
  }

  onMounted(() => {
    void api.getActivity().then((next) => {
      activity = next
    })
    unsubscribers.push(
      // FR-118: from the next wander; an idle cat waits by the new level's timing now.
      api.onActivityChanged((next) => {
        activity = next
        if (state.value === 'idle' && wanderTimer) scheduleWander()
      }),
      api.onWalkEnded(() => {
        if (state.value === 'walk') dispatch('arrived')
      }),
      // requirement-v5.md FR-60, FR-63: main moves the window; the pet only shows it.
      api.onFallStart(() => dispatch('fallStart')),
      api.onLanded(() => dispatch('landed')),
      api.onClimbPhase((phase) => dispatch(phase === 'climb' ? 'atWall' : 'holdPoint')),
      // FR-115: main's clock: one play of the hop clip per hop.
      api.onHopStep(() => {
        if (state.value === 'hop') scene.play('hop')
      }),
      api.onUserIdleChanged((idle) => {
        userIdle = idle
        dispatch(idle ? 'sleep' : 'wake')
        if (!idle) maybeMorningStretch()
      }),
      api.onCareState((view) => {
        const first = mood === null && view !== null
        careView.value = view
        mood = view ? view.mood : null
        // requirement-v7.md FR-107: the cat is drawn in its look.
        if (view) scene.setLook(view.look)
        // The app just started with a cat (or one was adopted): maybe a morning stretch.
        if (first) maybeMorningStretch()
        syncLookWatch()
      }),
      api.onCareRequest(onCareRequest),
      api.onFocusReaction(onFocusReaction),
      api.onCursor(onCursor),
      // FR-121: main hid the buttons (hide delay, a button, hidden).
      api.onActionsClosed(() => {
        if (!actionsShown) return
        actionsShown = false
        dispatch('actionsClosed')
      })
    )
    // Hidden from the tray or by a fullscreen app: stop cursor updates (NFR-21).
    document.addEventListener('visibilitychange', syncLookWatch)
    unsubscribers.push(() => document.removeEventListener('visibilitychange', syncLookWatch))
    enter(state.value)

    if (import.meta.env.DEV) {
      // Dev-only hook for driving behaviors from DevTools during manual testing.
      window.__petDebug = {
        dispatch,
        state: () => state.value,
        scene: () => scene.current(),
        // Preview any clip (including v2 care clips) without changing the behavior state.
        playClip: (clip: ClipName) => scene.play(clip),
        setUserIdle: (idle: boolean) => {
          userIdle = idle
          dispatch(idle ? 'sleep' : 'wake')
        },
        mood: () => mood,
        // Fire the wander timer now (walk or hungry reminder, as the mood decides).
        wanderNow: () => {
          if (state.value === 'idle') onWanderTimer()
        },
        // Draw the cat in another look, in this window only (requirement-v7.md FR-107).
        setLook: (look: string | null) => scene.setLook(look),
        // Try a jump now, without the chance or the cooldown (requirement-v5.md FR-73).
        jumpNow: () => {
          if (state.value === 'idle') void tryJump()
        },
        // Try a climb now, without the chance or the cooldown (FR-76).
        // Try a hop run now, without the chance or the interval (requirement-v8.md FR-114).
        hopNow: () => {
          if (state.value === 'idle') void tryHop()
        },
        climbNow: () => {
          if (state.value === 'idle') void tryClimb()
        },
        // Look at the mouse without moving the real cursor.
        cursor: onCursor,
        lookWatching: () => lookWatching,
        // requirement-v9.md: open the quick buttons as if the pointer rested on the cat.
        actionsNow: () => void openActions(),
        actionsOpen: () => actionsShown
      }
    }
  })

  onBeforeUnmount(() => {
    clearWander()
    unsubscribers.forEach((fn) => fn())
    if (state.value === 'walk') api.stopWalk()
    if (state.value === 'drag') api.endDrag()
    if (lookWatching) api.setLookWatch(false)
    closeActions()
    if (import.meta.env.DEV) delete window.__petDebug
  })

  return {
    state: readonly(state),
    care: readonly(careView),
    dispatch,
    click,
    stroke: petNow,
    canOpenActions,
    openActions: () => void openActions(),
    closeActions,
    pointerOnPet: (over) => {
      if (actionsShown) api.setActionsPointer(over)
    }
  }
}
