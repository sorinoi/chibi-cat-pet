import { describe, expect, it } from 'vitest'
import {
  allowedArea,
  directionTowardRoom,
  patrolDirection,
  clampPosition,
  fallDistance,
  floorY,
  isAboveFloor,
  planWalk,
  resizeKeepingFeet,
  scaledOverflow,
  scaledSize,
  snapToGrid
} from './placement'

describe('pet size', () => {
  it('scales the window and the overflow', () => {
    expect(scaledSize({ width: 380, height: 300 }, 1.5)).toEqual({ width: 572, height: 452 })
    // 225 x 1.25 = 281.25 px is not whole; 228 gives 285 px.
    expect(scaledSize({ width: 224, height: 225 }, 1)).toEqual({ width: 224, height: 228 })
    expect(scaledOverflow({ x: 60, top: 0, bottom: 40 }, 0.5)).toEqual({
      x: 30,
      top: 0,
      bottom: 20
    })
  })

  it('keeps the bottom center fixed when resizing', () => {
    const before = { x: 100, y: 100, width: 380, height: 300 }
    const after = resizeKeepingFeet(before, { width: 760, height: 600 })
    expect(after).toEqual({ x: -90, y: -200, width: 760, height: 600 })
    expect(after.x + after.width / 2).toBe(before.x + before.width / 2)
    expect(after.y + after.height).toBe(before.y + before.height)
  })
})

const workArea = { x: 0, y: 0, width: 1920, height: 1040 }
const size = { width: 300, height: 300 }
const overflow = { x: 60, top: 0, bottom: 40 }

describe('allowedArea', () => {
  it('lets the window hang past the edges by the overflow', () => {
    expect(allowedArea(workArea, size, overflow)).toEqual({
      minX: -60,
      maxX: 1680,
      minY: 0,
      maxY: 780
    })
  })

  it('works on a secondary display with negative coordinates', () => {
    const area = allowedArea({ x: -1280, y: 100, width: 1280, height: 984 }, size, overflow)
    expect(area.minX).toBe(-1340)
    expect(area.maxX).toBe(-240)
  })

  it('never inverts the range when the work area is tiny', () => {
    const area = allowedArea({ x: 0, y: 0, width: 100, height: 100 }, size, overflow)
    expect(area.maxX).toBeGreaterThanOrEqual(area.minX)
    expect(area.maxY).toBeGreaterThanOrEqual(area.minY)
  })
})

describe('clampPosition', () => {
  const area = allowedArea(workArea, size, overflow)

  it('keeps positions inside the area', () => {
    expect(clampPosition(-500, 2000, area)).toEqual({ x: -60, y: 780 })
    expect(clampPosition(100, 200, area)).toEqual({ x: 100, y: 200 })
  })
})

describe('planWalk', () => {
  const area = allowedArea(workArea, size, overflow)

  it('walks the requested distance when there is room', () => {
    expect(planWalk(500, 200, area, 40)).toBe(200)
    expect(planWalk(500, -200, area, 40)).toBe(-200)
  })

  it('stops at the edge', () => {
    expect(planWalk(1600, 200, area, 40)).toBe(80)
  })

  it('turns around when it is already at the edge', () => {
    expect(planWalk(1680, 200, area, 40)).toBe(-200)
  })

  it('returns 0 when there is no room either way', () => {
    const narrow = { minX: 0, maxX: 30, minY: 0, maxY: 0 }
    expect(planWalk(15, 100, narrow, 40)).toBe(0)
  })
})

describe('snapToGrid', () => {
  const area = { minX: -60, maxX: 1680, minY: 0, maxY: 780 }

  it('rounds the start position to whole pixels at common scales', () => {
    expect(snapToGrid(275, 814, { ...area, maxY: 1000 })).toEqual({ x: 276, y: 816 })
    expect(snapToGrid(1801, 802, { ...area, maxX: 2000, maxY: 1000 })).toEqual({ x: 1800, y: 804 })
  })

  it('still keeps the window inside the area', () => {
    expect(snapToGrid(5000, -50, area)).toEqual({ x: 1680, y: 0 })
  })
})

describe('falling (requirement-v5.md FR-60, FR-61)', () => {
  const area = { minX: -60, maxX: 1680, minY: 0, maxY: 780 }

  it('stands on the lowest allowed position', () => {
    expect(floorY(area)).toBe(780)
    expect(isAboveFloor(780, area, 2)).toBe(false)
    expect(isAboveFloor(779, area, 2)).toBe(false)
    expect(isAboveFloor(700, area, 2)).toBe(true)
  })

  it('speeds up, then keeps the top speed', () => {
    expect(fallDistance(0, 2000, 2400)).toBe(0)
    expect(fallDistance(-50, 2000, 2400)).toBe(0)
    expect(fallDistance(500, 2000, 2400)).toBeCloseTo(250)
    expect(fallDistance(1000, 2000, 2400)).toBeCloseTo(1000)
    // Top speed after 1.2 s (1440 DIP), then 2400 DIP/s.
    expect(fallDistance(1200, 2000, 2400)).toBeCloseTo(1440)
    expect(fallDistance(1700, 2000, 2400)).toBeCloseTo(2640)
  })

  it('crosses a 1080p screen in about a second (NFR-26)', () => {
    expect(fallDistance(1000, 2000, 2400)).toBeLessThan(1080)
    expect(fallDistance(1100, 2000, 2400)).toBeGreaterThan(1080)
  })
})

describe('directionTowardRoom (requirement-v8.md FR-111)', () => {
  const area = { minX: 0, maxX: 1000, minY: 0, maxY: 500 }

  it('goes 50/50 in the middle and almost always toward the open side near an edge', () => {
    expect(directionTowardRoom(500, area, 0.49)).toBe(1)
    expect(directionTowardRoom(500, area, 0.51)).toBe(-1)
    expect(directionTowardRoom(50, area, 0.94)).toBe(1) // 95 % of the room is to the right
    expect(directionTowardRoom(50, area, 0.96)).toBe(-1)
    expect(directionTowardRoom(950, area, 0.06)).toBe(-1)
  })

  it('at an edge, or with no room at all, it still answers', () => {
    expect(directionTowardRoom(0, area, 0.999)).toBe(1)
    expect(directionTowardRoom(1000, area, 0)).toBe(-1)
    expect(directionTowardRoom(5, { ...area, minX: 5, maxX: 5 }, 0.5)).toBe(1)
  })

  it('over many walks the cat drifts toward open space', () => {
    let rights = 0
    for (let i = 0; i < 1000; i++) if (directionTowardRoom(200, area, i / 1000) === 1) rights++
    expect(rights).toBe(800)
  })
})

describe('patrolDirection (requirement-v8.md FR-111, patrol)', () => {
  const area = { minX: 0, maxX: 1000, minY: 0, maxY: 500 }

  it('keeps going the same way 3 in 4 walks while there is room ahead', () => {
    expect(patrolDirection(300, area, 200, 1, 0.74, 0.75)).toBe(1)
    expect(patrolDirection(300, area, 200, 1, 0.76, 0.75)).toBe(-1)
    expect(patrolDirection(700, area, 200, -1, 0.1, 0.75)).toBe(-1)
  })

  it('turns when the room ahead is shorter than the walk', () => {
    expect(patrolDirection(900, area, 200, 1, 0, 0.75)).toBe(-1)
    expect(patrolDirection(100, area, 200, -1, 0, 0.75)).toBe(1)
  })

  it('the first walk heads toward the side with more room', () => {
    expect(patrolDirection(100, area, 200, 0, 0.5, 0.75)).toBe(1)
  })

  it('sweeps the whole floor: a run of walks reaches both ends', () => {
    let x = 500
    let last: 1 | -1 | 0 = 0
    let seenMin = x
    let seenMax = x
    for (let i = 0; i < 40; i++) {
      const d = patrolDirection(x, area, 250, last, (i * 0.37) % 1, 0.75)
      x = Math.min(area.maxX, Math.max(area.minX, x + d * 250))
      last = d
      seenMin = Math.min(seenMin, x)
      seenMax = Math.max(seenMax, x)
    }
    expect(seenMin).toBeLessThan(250)
    expect(seenMax).toBeGreaterThan(750)
  })
})
