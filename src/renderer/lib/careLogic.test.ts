import { describe, expect, it } from 'vitest'
import { CARE } from '../../shared/careConfig'
import { clickReaction, idleAction, wanderDelayMs } from './careBehavior'
import { createStrokeDetector, type StrokeSample } from './strokeDetector'

/** Moves at 10 ms steps through the given x positions, over the cat, nothing pressed. */
function moves(xs: number[], start = 0, overrides: Partial<StrokeSample> = {}): StrokeSample[] {
  return xs.map((x, i) => ({ x, t: start + i * 10, overPet: true, pressed: false, ...overrides }))
}

const fired = (samples: StrokeSample[]): boolean => {
  const d = createStrokeDetector()
  return samples.some((s) => d.push(s))
}

/** Back and forth between 100 and 130 in 10 px steps. */
const strokeXs = [100, 110, 120, 130, 120, 110, 100, 110, 120, 130, 120, 110, 100]

describe('stroke detector (FR-18)', () => {
  it('recognizes back-and-forth over the cat', () => {
    expect(fired(moves(strokeXs))).toBe(true)
  })

  it('ignores a straight sweep across the cat', () => {
    expect(fired(moves([0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]))).toBe(false)
  })

  it('ignores tiny jitter', () => {
    expect(fired(moves([100, 102, 100, 102, 100, 102, 100, 102, 100, 102]))).toBe(false)
  })

  it('needs the reversals within 1.5 s', () => {
    const slow = strokeXs.map((x, i) => ({ x, t: i * 400, overPet: true, pressed: false }))
    expect(fired(slow)).toBe(false)
  })

  it('does not count moves off the cat or with a button held', () => {
    expect(fired(moves(strokeXs, 0, { pressed: true }))).toBe(false)
    const leaving = moves(strokeXs).map((s, i) => (i % 4 === 3 ? { ...s, overPet: false } : s))
    expect(fired(leaving)).toBe(false)
  })

  it('starts over after a recognized stroke', () => {
    const d = createStrokeDetector()
    expect(moves(strokeXs).some((s) => d.push(s))).toBe(true)
    expect(d.push({ x: 110, t: 200, overPet: true, pressed: false })).toBe(false)
  })
})

describe('idleAction', () => {
  const cooldown = CARE.behavior.hungryReminderCooldownMs

  it('wanders unless the pet is hungry', () => {
    expect(idleAction(null, 0, null)).toBe('wander')
    expect(idleAction('sad', 0, null)).toBe('wander')
    expect(idleAction('hungry', 0, null)).toBe('hungry')
  })

  it('shows the hungry reminder at most every 10 minutes', () => {
    expect(idleAction('hungry', cooldown - 1, 0)).toBe('wander')
    expect(idleAction('hungry', cooldown, 0)).toBe('hungry')
    expect(idleAction('hungry', 5, 1_000)).toBe('hungry') // clock moved backwards
  })
})

describe('wanderDelayMs', () => {
  it('waits twice as long when sad', () => {
    const range = { min: 20, max: 60 }
    expect(wanderDelayMs('content', range, 0.5)).toBe(40_000)
    expect(wanderDelayMs('sad', range, 0.5)).toBe(80_000)
    expect(wanderDelayMs(null, range, 0)).toBe(20_000)
  })
})

describe('clickReaction', () => {
  it('plays happy about half the time only when the mood is happy', () => {
    expect(clickReaction('happy', 0.2)).toBe('happy')
    expect(clickReaction('happy', 0.8)).toBe('click')
    expect(clickReaction('content', 0)).toBe('click')
    expect(clickReaction(null, 0)).toBe('click')
  })
})
