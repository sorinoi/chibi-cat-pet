import type { StandardClip } from '../../shared/modelConfig'

/** Pet behavior states. Each state plays the standard clip of the same name. */
export type PetState = StandardClip

export type PetEvent =
  'click' | 'dragStart' | 'dragEnd' | 'clipFinished' | 'wander' | 'arrived' | 'sleep' | 'wake'

const TRANSITIONS: Record<PetState, Partial<Record<PetEvent, PetState>>> = {
  idle: { click: 'click', dragStart: 'drag', wander: 'walk', sleep: 'sleep' },
  walk: { click: 'click', dragStart: 'drag', arrived: 'idle', sleep: 'sleep' },
  click: { clipFinished: 'idle', dragStart: 'drag' },
  drag: { dragEnd: 'land' },
  land: { clipFinished: 'idle', dragStart: 'drag', click: 'click' },
  sleep: { click: 'click', dragStart: 'drag', wake: 'idle' }
}

/** Returns the next state, or null when the event does not apply in this state. */
export function transition(state: PetState, event: PetEvent): PetState | null {
  return TRANSITIONS[state][event] ?? null
}
