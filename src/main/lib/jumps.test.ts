import { describe, expect, it } from 'vitest'
import {
  arcPoint,
  atPerchEnd,
  chooseJump,
  jumpDownSpot,
  jumpDurationMs,
  jumpUpTargets,
  type JumpQuery,
  type JumpUpTarget
} from './jumps'
import type { DesktopWindow } from './ledges'

const display = { x: 0, y: 0, width: 2000, height: 1200 }
const area = { minX: -30, maxX: 1870, minY: 0, maxY: 1002 }

let nextId = 1
function win(rect: DesktopWindow['rect'], extra: Partial<DesktopWindow> = {}): DesktopWindow {
  return {
    id: nextId++,
    rect,
    title: 'Notes',
    className: 'Notepad',
    visible: true,
    minimized: false,
    maximized: false,
    cloaked: false,
    own: false,
    toolWindow: false,
    noActivate: false,
    appWindow: false,
    clickThrough: false,
    ...extra
  }
}

/** A cat on the floor at x 900 (centre 980, feet 1150): rise 64..480, side up to 640. */
function query(x = 900, y = 1002): JumpQuery {
  return {
    x,
    y,
    size: { width: 160, height: 160 },
    feetOffset: 148,
    footHalfWidth: 32,
    minPerchWidth: 320,
    edgeMargin: 32,
    area,
    minRise: 64,
    maxRise: 480,
    maxSide: 640
  }
}

const targets = (windows: DesktopWindow[], q = query()): JumpUpTarget[] =>
  jumpUpTargets(q, windows, [display])

describe('jumpUpTargets (requirement-v5.md FR-73)', () => {
  it('finds an edge above the cat in reach, at the nearest spot on it', () => {
    const w = win({ x: 600, y: 800, width: 800, height: 300 })
    expect(targets([w])).toEqual([{ x: 900, y: 652, perchId: w.id, perchRect: w.rect }])
  })

  it('walks the landing spot onto the edge when the cat is beside the window', () => {
    const w = win({ x: 1200, y: 800, width: 500, height: 300 })
    // Nearest walkable x: 1200 + 32 - 80 = 1152.
    expect(targets([w])[0]).toMatchObject({ x: 1152, y: 652 })
  })

  it('skips edges too high, too low, too far sideways or not perches', () => {
    const tooHigh = win({ x: 600, y: 600, width: 800, height: 300 }) // rise 550
    const tooLow = win({ x: 600, y: 1100, width: 800, height: 300 }) // rise 50
    const tooFar = win({ x: 1700, y: 900, width: 300, height: 200 }, { title: 'x' }) // narrow too
    const farWide = win({ x: 1650, y: 900, width: 340, height: 200 }) // 1650 + 32 - 80 = 1602: 702 away
    const minimized = win({ x: 600, y: 800, width: 800, height: 300 }, { minimized: true })
    expect(targets([tooHigh, tooLow, tooFar, farWide, minimized])).toEqual([])
  })

  it('skips an edge covered at the landing spot by a window in front', () => {
    const w = win({ x: 600, y: 800, width: 800, height: 300 })
    const cover = win({ x: 950, y: 750, width: 100, height: 100 }, { title: '' })
    expect(targets([cover, w])).toEqual([])
    expect(targets([w, cover])).toHaveLength(1) // behind the perch: not a cover
  })

  it('skips an edge with no room above it for the cat', () => {
    const w = win({ x: 600, y: 100, width: 800, height: 300 })
    expect(targets([w], query(900, 200))).toEqual([]) // 100 - 148 < 0
  })
})

describe('jumpDownSpot and atPerchEnd (FR-75)', () => {
  const perch = { x: 600, y: 800, width: 800, height: 300 }

  it('picks the spot past the nearer end, at the same height', () => {
    // Cat centre 1300 on a perch 600..1400: the right end is nearer.
    expect(jumpDownSpot(query(1220, 652), perch, 96)).toEqual({ x: 1416, y: 652 })
    expect(jumpDownSpot(query(640, 652), perch, 96)).toEqual({ x: 424, y: 652 })
  })

  it('uses the other end when the nearer one is off the screen area', () => {
    const atScreenEdge = { x: 1700, y: 800, width: 300, height: 300 }
    // Right spot centre 2096 -> x 2016 > maxX 1870; left spot centre 1604 -> x 1524.
    expect(jumpDownSpot(query(1760, 652), atScreenEdge, 96)).toEqual({ x: 1524, y: 652 })
  })

  it('knows when the cat stands at an end of its walkable stretch', () => {
    // Walkable x: 552..1288.
    expect(atPerchEnd(query(552, 652), perch, 8)).toBe(true)
    expect(atPerchEnd(query(1284, 652), perch, 8)).toBe(true)
    expect(atPerchEnd(query(900, 652), perch, 8)).toBe(false)
  })
})

describe('chooseJump', () => {
  const up: JumpUpTarget = {
    x: 900,
    y: 652,
    perchId: 7,
    perchRect: { x: 600, y: 800, width: 800, height: 300 }
  }
  const down = { x: 1416, y: 652 }

  it('jumps down at the end of a perch', () => {
    expect(chooseJump([up], down, true, () => 0.9)).toEqual({ kind: 'down', to: down })
  })

  it('on a perch elsewhere it goes up or down by chance', () => {
    expect(chooseJump([up], down, false, () => 0.2)?.kind).toBe('down')
    expect(chooseJump([up], down, false, () => 0.7)?.kind).toBe('up')
  })

  it('on the floor only up, and nothing without a target', () => {
    expect(chooseJump([up], null, false, () => 0.1)).toEqual({
      kind: 'up',
      to: { x: 900, y: 652 },
      perchId: 7,
      perchRect: up.perchRect
    })
    expect(chooseJump([], null, false, () => 0.1)).toBeNull()
  })
})

describe('arc', () => {
  const from = { x: 0, y: 1000 }
  const to = { x: 200, y: 600 }

  it('starts and ends at the two points and peaks lift above the higher one', () => {
    expect(arcPoint(from, to, 80, 0)).toEqual(from)
    expect(arcPoint(from, to, 80, 1)).toEqual(to)
    expect(arcPoint(from, to, 80, 0.5)).toEqual({ x: 100, y: 520 })
  })

  it('takes longer for longer jumps, up to a limit', () => {
    const timing = { baseMs: 300, msPerDip: 1, maxMs: 700 }
    expect(jumpDurationMs(from, { x: 0, y: 900 }, timing)).toBe(400)
    expect(jumpDurationMs(from, to, timing)).toBe(700)
  })
})
