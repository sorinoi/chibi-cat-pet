import { describe, expect, it } from 'vitest'
import { transition, type PetEvent, type PetState } from './petMachine'

function run(start: PetState, events: PetEvent[]): PetState {
  return events.reduce<PetState>((state, event) => transition(state, event) ?? state, start)
}

describe('pet state machine', () => {
  it('plays the click reaction once, then returns to idle', () => {
    expect(transition('idle', 'click')).toBe('click')
    expect(transition('click', 'clipFinished')).toBe('idle')
  })

  it('goes drag -> land -> idle', () => {
    expect(run('idle', ['dragStart', 'dragEnd', 'clipFinished'])).toBe('idle')
    expect(run('idle', ['dragStart', 'dragEnd'])).toBe('land')
  })

  it('can be picked up from any resting or moving state', () => {
    for (const state of ['idle', 'walk', 'click', 'land', 'sleep'] as const) {
      expect(transition(state, 'dragStart')).toBe('drag')
    }
  })

  it('ignores everything except release while dragged', () => {
    for (const event of ['click', 'wander', 'sleep', 'wake', 'clipFinished', 'arrived'] as const) {
      expect(transition('drag', event)).toBeNull()
    }
  })

  it('walks and returns to idle on arrival', () => {
    expect(run('idle', ['wander', 'arrived'])).toBe('idle')
  })

  it('sleeps from idle or walk, wakes on activity or a click', () => {
    expect(transition('idle', 'sleep')).toBe('sleep')
    expect(transition('walk', 'sleep')).toBe('sleep')
    expect(transition('sleep', 'wake')).toBe('idle')
    expect(transition('sleep', 'click')).toBe('click')
  })

  it('does not wander or sleep in the middle of a reaction', () => {
    expect(transition('click', 'wander')).toBeNull()
    expect(transition('click', 'sleep')).toBeNull()
    expect(transition('land', 'wander')).toBeNull()
  })
})
