import { describe, expect, it } from 'vitest'
import { climbRise, planClimb, type ClimbQuery } from './climbs'

// One display 2000 x 1150 work area; the pet window is 160 x 160 and may hang 20 DIP past.
const work = { x: 0, y: 0, width: 2000, height: 1150 }
const area = { minX: -20, maxX: 1860, minY: 0, maxY: 1002 }

function query(x: number, extra: Partial<ClimbQuery> = {}): ClimbQuery {
  return {
    x,
    y: 1002,
    size: { width: 160, height: 160 },
    area,
    work,
    wallOffset: { climb: 43, hang: 39 },
    rise: 500,
    minRise: 80,
    ...extra
  }
}

describe('planClimb (requirement-v5.md FR-76, section 8)', () => {
  it('climbs the nearer edge with the paws exactly on it', () => {
    // Centre 1580: the right edge (2000) is nearer. Paws at centre + 43 = 2000.
    expect(planClimb(query(1500))).toEqual({
      side: 'right',
      walkToX: 1860,
      climbX: 2000 - 43 - 80,
      holdX: 2000 - 39 - 80,
      topY: 502
    })
    // Centre 380: the left edge. Paws at centre - 43 = 0.
    expect(planClimb(query(300))).toMatchObject({ side: 'left', climbX: 43 - 80, holdX: 39 - 80 })
  })

  it('walks only as far as the allowed area; the climb position may hang past it', () => {
    const plan = planClimb(query(1500))
    expect(plan?.walkToX).toBe(area.maxX)
    expect(plan?.climbX).toBeGreaterThan(area.maxX)
  })

  it('never climbs above the area, and skips a climb that would be too short', () => {
    expect(planClimb(query(1500, { rise: 5000 }))?.topY).toBe(0)
    expect(planClimb(query(1500, { y: 60, rise: 500 }))).toBeNull() // only 60 to climb
  })

  it('uses the edges of the display it stands on (a second display to the right)', () => {
    const second = { x: 2000, y: 0, width: 1920, height: 1040 }
    const plan = planClimb(
      query(2100, { work: second, area: { minX: 1980, maxX: 3780, minY: 0, maxY: 892 }, y: 892 })
    )
    expect(plan).toMatchObject({ side: 'left', climbX: 2000 + 43 - 80 })
  })
})

describe('climbRise', () => {
  it('stays between the two shares of the work area height', () => {
    const range = { minShare: 0.25, maxShare: 0.75 }
    expect(climbRise(1000, range, 0)).toBe(250)
    expect(climbRise(1000, range, 1)).toBe(750)
    expect(climbRise(1000, range, 0.5)).toBe(500)
  })
})
