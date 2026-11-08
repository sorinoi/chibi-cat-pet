import { describe, expect, it } from 'vitest'
import { hopProgress, hopTiming, planHops } from './hops'

const area = { minX: 0, maxX: 1000, minY: 0, maxY: 500 }

describe('planHops (requirement-v8.md FR-114)', () => {
  it('lands each hop further along in one direction', () => {
    expect(planHops({ x: 100, area, direction: 1, count: 3, distance: 50, minHop: 20 })).toEqual([
      150, 200, 250
    ])
    expect(planHops({ x: 500, area, direction: -1, count: 2, distance: 60, minHop: 20 })).toEqual([
      440, 380
    ])
  })

  it('ends the run at the edge of the area', () => {
    expect(planHops({ x: 920, area, direction: 1, count: 5, distance: 50, minHop: 20 })).toEqual([
      970, 1000
    ])
    expect(planHops({ x: 990, area, direction: 1, count: 5, distance: 50, minHop: 20 })).toEqual([])
  })
})

describe('hopTiming and hopProgress (FR-114)', () => {
  // The shipped clip: sit 120, crouch 160 | push 90, rise 90, top 110, fall 90 | land 140, sit 160.
  const timing = hopTiming([120, 160, 90, 90, 110, 90, 140, 160], 2, 5)

  it('splits the clip into crouch, air and landing', () => {
    expect(timing).toEqual({ groundMs: 280, airMs: 380, landMs: 300, totalMs: 960 })
  })

  it('stays put while crouching, flies across the air time, then stays landed', () => {
    expect(hopProgress(100, timing)).toBe(0)
    expect(hopProgress(280 + 190, timing)).toBeCloseTo(0.5)
    expect(hopProgress(700, timing)).toBe(1)
    expect(hopProgress(900, timing)).toBe(1)
  })
})
