import { describe, expect, it } from 'vitest'
import { CARE } from './careConfig'
import { advanceNeeds, click, feed, moodOf, pet, runningMode, type Needs } from './needs'

const HOUR = 3_600_000
const n = (hunger: number, happiness: number): Needs => ({ hunger, happiness })

describe('advanceNeeds: awake', () => {
  it('empties hunger in 10 h and happiness in 12 h at full rate', () => {
    expect(advanceNeeds(n(100, 100), 1 * HOUR, 'awake').hunger).toBeCloseTo(90)
    expect(advanceNeeds(n(100, 100), 1 * HOUR, 'awake').happiness).toBeCloseTo(100 - 100 / 12)
    expect(advanceNeeds(n(100, 50), 10 * HOUR, 'awake').hunger).toBeCloseTo(0)
  })

  it('never goes below 0', () => {
    expect(advanceNeeds(n(5, 5), 100 * HOUR, 'awake')).toEqual(n(0, 0))
  })

  it('drops happiness twice as fast only while hungry (hunger < 30)', () => {
    // Already hungry: 1 h costs 2 * 100/12.
    const hungry = advanceNeeds(n(20, 100), 1 * HOUR, 'awake')
    expect(hungry.happiness).toBeCloseTo(100 - 200 / 12)
    // Hunger 40 reaches 30 after 1 h; the second hour is hungry.
    const crossing = advanceNeeds(n(40, 100), 2 * HOUR, 'awake')
    expect(crossing.hunger).toBeCloseTo(20)
    expect(crossing.happiness).toBeCloseTo(100 - 100 / 12 - 200 / 12)
  })

  it('gives the same result in one step or many small ones', () => {
    const once = advanceNeeds(n(45, 90), 3 * HOUR, 'awake')
    let many = n(45, 90)
    for (let i = 0; i < 180; i++) many = advanceNeeds(many, 60_000, 'awake')
    expect(many.hunger).toBeCloseTo(once.hunger, 6)
    expect(many.happiness).toBeCloseTo(once.happiness, 6)
  })
})

describe('advanceNeeds: asleep and offline', () => {
  it('runs at half rate while the pet sleeps', () => {
    expect(advanceNeeds(n(100, 100), 2 * HOUR, 'asleep').hunger).toBeCloseTo(90)
  })

  it('runs at a quarter rate while the app is closed', () => {
    expect(advanceNeeds(n(100, 100), 4 * HOUR, 'offline').hunger).toBeCloseTo(90)
  })

  it('never takes a need below the floor offline, even after a long holiday', () => {
    expect(advanceNeeds(n(80, 80), 30 * 24 * HOUR, 'offline')).toEqual(
      n(CARE.offlineFloor, CARE.offlineFloor)
    )
  })

  it('leaves needs already below the floor as they are offline (no lower, no higher)', () => {
    expect(advanceNeeds(n(10, 25), 48 * HOUR, 'offline')).toEqual(n(10, 25))
  })

  it('does not count offline hunger at the floor (30) as hungry', () => {
    // Hunger stops at 30, so happiness keeps the normal offline rate.
    const r = advanceNeeds(n(31, 100), 10 * HOUR, 'offline')
    expect(r.hunger).toBe(30)
    expect(r.happiness).toBeCloseTo(100 - (100 / 12) * 10 * 0.25)
  })
})

describe('advanceNeeds: clock safety', () => {
  it('changes nothing when time goes backwards or does not pass', () => {
    expect(advanceNeeds(n(50, 60), -HOUR, 'awake')).toEqual(n(50, 60))
    expect(advanceNeeds(n(50, 60), 0, 'offline')).toEqual(n(50, 60))
    expect(advanceNeeds(n(50, 60), Number.NaN, 'awake')).toEqual(n(50, 60))
  })
})

describe('runningMode', () => {
  it('uses the awake or sleep rate between normal ticks', () => {
    expect(runningMode(60_000, false)).toBe('awake')
    expect(runningMode(60_000, true)).toBe('asleep')
  })

  it('treats a long gap (PC asleep, app frozen) as offline', () => {
    expect(runningMode(CARE.maxTickGapMs + 1, false)).toBe('offline')
  })
})

describe('moodOf', () => {
  it('ranks hungry over sad over happy over content', () => {
    expect(moodOf(n(29, 10))).toBe('hungry')
    expect(moodOf(n(50, 29))).toBe('sad')
    expect(moodOf(n(80, 80))).toBe('happy')
    expect(moodOf(n(79, 90))).toBe('content')
    expect(moodOf(n(30, 30))).toBe('content')
  })
})

describe('care actions', () => {
  it('feeding adds +40 hunger and +5 happiness, capped at 100', () => {
    expect(feed(n(50, 50))).toEqual({ needs: n(90, 55), refused: false })
    expect(feed(n(80, 98)).needs).toEqual(n(100, 100))
  })

  it('a full pet (hunger >= 95) refuses food', () => {
    expect(feed(n(95, 50))).toEqual({ needs: n(95, 50), refused: true })
    expect(feed(n(94.9, 50)).refused).toBe(false)
  })

  it('petting adds +15 happiness once per 30 s', () => {
    const first = pet(n(50, 50), 1_000, null)
    expect(first).toEqual({ needs: n(50, 65), counted: true })
    expect(pet(first.needs, 1_000 + 29_999, 1_000).counted).toBe(false)
    expect(pet(first.needs, 1_000 + 30_000, 1_000)).toEqual({ needs: n(50, 80), counted: true })
  })

  it('clicking adds +2 happiness once per 10 s', () => {
    expect(click(n(50, 99), 0, null).needs).toEqual(n(50, 100))
    expect(click(n(50, 50), 5_000, 0).counted).toBe(false)
  })

  it('counts a bonus again if the clock moved backwards past the last one', () => {
    expect(pet(n(50, 50), 500, 1_000).counted).toBe(true)
  })
})
