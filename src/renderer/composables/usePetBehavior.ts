import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'
import { BEHAVIOR } from '../config'
import { transition, type PetEvent, type PetState } from '../lib/petMachine'
import type { PetScene } from './usePetScene'

export interface PetBehavior {
  state: Readonly<Ref<PetState>>
  dispatch(event: PetEvent): void
}

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

/**
 * Drives the pet state machine: plays the matching clip on every state change,
 * schedules wandering (FR-06), sleeps while the user is away (FR-07), and asks
 * the main process to move the window for walk and drag.
 */
export function usePetBehavior(scene: PetScene): PetBehavior {
  const api = window.petApi
  const state = ref<PetState>('idle')
  let wanderTimer: ReturnType<typeof setTimeout> | null = null
  let userIdle = false
  const unsubscribers: Array<() => void> = []

  function clearWander(): void {
    if (wanderTimer) clearTimeout(wanderTimer)
    wanderTimer = null
  }

  function scheduleWander(): void {
    clearWander()
    const { min, max } = BEHAVIOR.wanderDelaySeconds
    // Do not walk while hidden from the tray: try again later instead.
    const fire = (): void => (document.hidden ? scheduleWander() : dispatch('wander'))
    wanderTimer = setTimeout(fire, randomBetween(min, max) * 1000)
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
    scene.play(to)

    switch (to) {
      case 'idle':
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
      case 'click':
      case 'sleep':
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
    if (clip === state.value) dispatch('clipFinished')
  })

  onMounted(() => {
    unsubscribers.push(
      api.onWalkEnded(() => {
        if (state.value === 'walk') dispatch('arrived')
      }),
      api.onUserIdleChanged((idle) => {
        userIdle = idle
        dispatch(idle ? 'sleep' : 'wake')
      })
    )
    enter(state.value)

    if (import.meta.env.DEV) {
      // Dev-only hook for driving behaviors from DevTools during manual testing.
      window.__petDebug = {
        dispatch,
        state: () => state.value,
        scene: () => scene.current(),
        setUserIdle: (idle: boolean) => {
          userIdle = idle
          dispatch(idle ? 'sleep' : 'wake')
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

  return { state: readonly(state), dispatch }
}
