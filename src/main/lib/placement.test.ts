import { describe, expect, it } from 'vitest'
import {
  allowedArea,
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
