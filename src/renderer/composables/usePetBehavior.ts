import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'
import { BEHAVIOR } from '../config'
import { clickReaction, idleAction, wanderDelayMs, type CareMood } from '../lib/careBehavior'
import { clipFor, transition, type PetEvent, type PetState } from '../lib/petMachine'
import type { PetScene } from './usePetScene'
import type { ClipName } from '../../shared/modelConfig'
import type { CareRequest, CareView } from '../../shared/ipc'
import type { FocusReaction } from '../../shared/focusText'

export interface PetBehavior {
  state: Readonly<Ref<PetState>>
  /** Care status from main (null = no pet yet), for the tooltip (FR-27). */
  care: Readonly<Ref<CareView | null>>
  dispatch(event: PetEvent): void
  /** A click on the cat (FR-03, FR-20): reaction depends on the mood; counts the bonus. */
  click(): void
  /** A recognized stroke (FR-18): plays pet and counts the bonus. */
  stroke(): void
}

/** Focus timer reaction -> state machine event (requirement-v3.md section 10). */
const FOCUS_CUE: Record<FocusReaction, PetEvent> = {
  focusStart: 'cueFocusStart',
  focusDone: 'cueFocusDone',
  breakOver: 'cueBreakOver',
  longBreak: 'cueLongBreak'
}

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

/**
 * Drives the pet state machine: plays the matching clip on every state change,
 * schedules wandering (FR-06), sleeps while the user is away (FR-07), asks the main
 * process to move the window for walk and drag, and reacts to care (requirement-v2.md
 * sections 5-6). The care mood comes from main; null means no pet is adopted yet.
 */
export function usePetBehavior(scene: PetScene): PetBehavior {
  const api = window.petApi
  const state = ref<PetState>('idle')
  const careView = ref<CareView | null>(null)
  let wanderTimer: ReturnType<typeof setTimeout> | null = null
  let userIdle = false
  let mood: CareMood = null
  let lastHungryReminderAt: number | null = null
  /** The pending care:act request for a Feed from a menu (main decides eat or refuse). */
  let feedInFlight: ReturnType<typeof api.careAct> | null = null
  /** A focus reaction that arrived during another reaction; plays on the next idle. */
  let queuedCue: PetEvent | null = null
  const unsubscribers: Array<() => void> = []

  function clearWander(): void {
    if (wanderTimer) clearTimeout(wanderTimer)
    wanderTimer = null
  }

  /** The wander timer: walk, or show the hungry reminder instead (section 5). */
  function onWanderTimer(): void {
    // Do not walk or nag while hidden from the tray or by a fullscreen app.
    if (document.hidden) {
      scheduleWander()
      return
    }
    const now = Date.now()
    if (idleAction(mood, now, lastHungryReminderAt) === 'hungry') {
      lastHungryReminderAt = now
      dispatch('hungryReminder')
    } else {
      dispatch('wander')
    }
  }

  function scheduleWander(): void {
    clearWander()
    wanderTimer = setTimeout(
      onWanderTimer,
      wanderDelayMs(mood, BEHAVIOR.wanderDelaySeconds, Math.random())
    )
  }

  async function startWalk(): Promise<void> {
    const { min, max } = BEHAVIOR.walkDistance
    const dx = randomBetween(min, max) * (Math.random() < 0.5 ? -1 : 1)
    const planned = await api.startWalk({ dx, speed: BEHAVIOR.walkSpeed })
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
  }

  function enter(to: PetState): void {
    // The hungry reminder is a looping clip; play it once (intro + one loop).
    scene.play(clipFor(to), to === 'hungry' ? { once: true } : undefined)

    switch (to) {
      case 'idle':
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
      case 'land':
        api.endDrag()
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
    enter(to)
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
    if (feedInFlight || mood === null || !transition(state.value, 'feed')) return
    feedInFlight = api.careAct('feed')
    try {
      const result = await feedInFlight
      // A drag in the meantime interrupts the reaction; the meal still counts (section 6).
      if (result) dispatch(result.refused ? 'refuseFood' : 'feed')
    } finally {
      feedInFlight = null
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

  function onCareRequest(request: CareRequest): void {
    if (request === 'feed') void feedNow()
    else if (request === 'pet') petNow()
    else dispatch('welcome') // FR-23: just adopted
  }

  onMounted(() => {
    unsubscribers.push(
      api.onWalkEnded(() => {
        if (state.value === 'walk') dispatch('arrived')
      }),
      api.onUserIdleChanged((idle) => {
        userIdle = idle
        dispatch(idle ? 'sleep' : 'wake')
      }),
      api.onCareState((view) => {
        careView.value = view
        mood = view ? view.mood : null
      }),
      api.onCareRequest(onCareRequest),
      api.onFocusReaction(onFocusReaction)
    )
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
        }
      }
    }
  })

  onBeforeUnmount(() => {
    clearWander()
    unsubscribers.forEach((fn) => fn())
    if (state.value === 'walk') api.stopWalk()
    if (state.value === 'drag') api.endDrag()
    if (import.meta.env.DEV) delete window.__petDebug
  })

  return { state: readonly(state), care: readonly(careView), dispatch, click, stroke: petNow }
}
