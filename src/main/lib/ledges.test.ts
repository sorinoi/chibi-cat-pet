import { describe, expect, it } from 'vitest'
import {
  findLanding,
  followPerch,
  isCover,
  isPerch,
  perchWalkArea,
  type DesktopWindow,
  type LandingQuery,
  type PerchQuery
} from './ledges'

const display = { x: 0, y: 0, width: 2000, height: 1200 }
// Work area 2000 x 1150 (taskbar below); window 160 x 160 hangs 12 DIP past the bottom.
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

/** A cat at x 900 (centre 980) with its feet at y + 148. */
function query(y: number): LandingQuery {
  return {
    x: 900,
    y,
    size: { width: 160, height: 160 },
    feetOffset: 148,
    footHalfWidth: 32,
    area,
    minPerchWidth: 320,
    tolerance: 2
  }
}

const land = (y: number, windows: DesktopWindow[]): ReturnType<typeof findLanding> =>
  findLanding(query(y), windows, [display])

describe('isPerch (requirement-v5.md FR-67)', () => {
  const ok = win({ x: 500, y: 400, width: 800, height: 500 })

  it('accepts a normal app window', () => {
    expect(isPerch(ok, [display], 320)).toBe(true)
  })

  it('skips minimized, maximized, cloaked, hidden, own and untitled windows', () => {
    for (const extra of [
      { minimized: true },
      { maximized: true },
      { cloaked: true },
      { visible: false },
      { own: true },
      { title: '  ' },
      { clickThrough: true }
    ]) {
      expect(isPerch({ ...ok, ...extra }, [display], 320)).toBe(false)
    }
  })

  it('skips tool and no-activate windows unless they have a taskbar button', () => {
    expect(isPerch({ ...ok, toolWindow: true }, [display], 320)).toBe(false)
    expect(isPerch({ ...ok, noActivate: true }, [display], 320)).toBe(false)
    expect(isPerch({ ...ok, toolWindow: true, appWindow: true }, [display], 320)).toBe(true)
  })

  it('skips windows narrower than the minimum', () => {
    expect(isPerch({ ...ok, rect: { ...ok.rect, width: 319 } }, [display], 320)).toBe(false)
  })

  it('skips fullscreen windows and the shell', () => {
    expect(
      isPerch({ ...ok, rect: { x: -8, y: -8, width: 2016, height: 1216 } }, [display], 320)
    ).toBe(false)
    expect(isPerch({ ...ok, className: 'Shell_TrayWnd' }, [display], 320)).toBe(false)
    expect(isPerch({ ...ok, className: 'Progman' }, [display], 320)).toBe(false)
  })
})

describe('isCover', () => {
  it('counts any visible window in front, also untitled and tool windows', () => {
    expect(
      isCover(win({ x: 0, y: 0, width: 50, height: 50 }, { title: '', toolWindow: true }))
    ).toBe(true)
  })

  it('ignores click-through overlays, the shell and our own windows', () => {
    const r = { x: 0, y: 0, width: 50, height: 50 }
    expect(isCover(win(r, { clickThrough: true }))).toBe(false)
    expect(isCover(win(r, { className: 'WorkerW' }))).toBe(false)
    expect(isCover(win(r, { own: true }))).toBe(false)
    expect(isCover(win(r, { minimized: true }))).toBe(false)
  })
})

describe('findLanding (FR-66)', () => {
  it('falls to the floor when nothing is below', () => {
    expect(land(100, [])).toMatchObject({ y: 1002, perchId: null })
  })

  it('lands on the top edge of a window under the cat', () => {
    const w = win({ x: 500, y: 600, width: 800, height: 400 })
    expect(land(100, [w])).toMatchObject({ y: 600 - 148, perchId: w.id })
  })

  it('takes the first edge on the way down', () => {
    const low = win({ x: 500, y: 800, width: 800, height: 300 })
    const high = win({ x: 600, y: 500, width: 700, height: 200 })
    expect(land(100, [low, high]).perchId).toBe(high.id)
  })

  it('ignores edges above the feet and windows beside the cat', () => {
    const above = win({ x: 500, y: 200, width: 800, height: 900 }) // feet at 248 are past it
    const beside = win({ x: 1100, y: 600, width: 600, height: 300 }) // centre 980 not over it
    expect(land(100, [above, beside])).toMatchObject({ y: 1002, perchId: null })
  })

  it('a cat already standing on an edge stays there', () => {
    const w = win({ x: 500, y: 600, width: 800, height: 400 })
    expect(land(452, [w])).toMatchObject({ y: 452, perchId: w.id })
    expect(land(453, [w])).toMatchObject({ y: 452, perchId: w.id }) // within the tolerance
  })

  it('skips an edge covered by a window in front, but not one only nearby', () => {
    const perch = win({ x: 500, y: 600, width: 800, height: 400 })
    const cover = win({ x: 950, y: 550, width: 300, height: 200 }, { title: '' })
    const nearby = win({ x: 1100, y: 550, width: 300, height: 200 }) // starts right of the feet
    expect(land(100, [cover, perch]).perchId).not.toBe(perch.id)
    expect(land(100, [nearby, perch]).perchId).toBe(perch.id)
    // A window behind the perch does not cover it.
    expect(land(100, [perch, cover]).perchId).toBe(perch.id)
  })

  it('lands on the covering window instead when its own edge is free', () => {
    const perch = win({ x: 500, y: 600, width: 800, height: 400 })
    const front = win({ x: 700, y: 550, width: 600, height: 200 })
    expect(land(100, [front, perch]).perchId).toBe(front.id)
  })

  it('skips an edge with no room for the cat above it', () => {
    const w = win({ x: 500, y: 100, width: 800, height: 400 }) // the cat would stick out the top
    expect(land(-60, [w]).perchId).toBeNull()
  })

  it('skips edges at or below the floor', () => {
    const w = win({ x: 500, y: 1150, width: 800, height: 400 })
    expect(land(100, [w])).toMatchObject({ y: 1002, perchId: null })
  })
})

describe('perchWalkArea (FR-68)', () => {
  const size = { width: 160, height: 160 }

  it('keeps the centre a margin inside the window', () => {
    const a = perchWalkArea(area, { x: 500, y: 600, width: 800, height: 300 }, size, 32)
    expect(a.minX).toBe(500 + 32 - 80)
    expect(a.maxX).toBe(1300 - 32 - 80)
    expect(a.minY).toBe(area.minY)
  })

  it('stays inside the screen area for a window partly off screen', () => {
    const a = perchWalkArea(area, { x: -400, y: 600, width: 800, height: 300 }, size, 32)
    expect(a.minX).toBe(area.minX)
    expect(a.maxX).toBe(400 - 32 - 80)
  })

  it('a window narrower than the margins leaves only its middle', () => {
    const a = perchWalkArea(area, { x: 500, y: 600, width: 40, height: 300 }, size, 32)
    expect(a.minX).toBe(a.maxX)
    expect(a.minX + 80).toBe(520)
  })
})

describe('followPerch (FR-69, FR-70)', () => {
  const perch = win({ x: 500, y: 600, width: 800, height: 300 })
  const q = (offsetX: number): PerchQuery => ({
    size: { width: 160, height: 160 },
    feetOffset: 148,
    footHalfWidth: 32,
    minPerchWidth: 320,
    edgeMargin: 32,
    offsetX,
    areaAt: () => area
  })
  const follow = (
    offsetX: number,
    target: DesktopWindow | null,
    front: DesktopWindow[] = []
  ): ReturnType<typeof followPerch> => followPerch(q(offsetX), target, front, [display])

  it('rides along when the window moves', () => {
    expect(follow(300, perch)).toEqual({ lost: false, x: 800, y: 452 })
    const moved = { ...perch, rect: { ...perch.rect, x: 650, y: 400 } }
    expect(follow(300, moved)).toEqual({ lost: false, x: 950, y: 252 })
  })

  it('moves inward when the window gets narrower', () => {
    const narrower = { ...perch, rect: { ...perch.rect, width: 400 } }
    // Centre may go up to 900 - 32 = 868, so x up to 788.
    expect(follow(500, narrower)).toEqual({ lost: false, x: 788, y: 452 })
  })

  it('is lost when the window is gone, minimized, maximized, cloaked or too narrow', () => {
    expect(follow(300, null)).toEqual({ lost: true })
    for (const extra of [
      { minimized: true },
      { maximized: true },
      { cloaked: true },
      { visible: false },
      { rect: { ...perch.rect, width: 300 } }
    ]) {
      expect(follow(300, { ...perch, ...extra })).toEqual({ lost: true })
    }
  })

  it('is lost when the window goes fullscreen', () => {
    expect(follow(300, { ...perch, rect: { x: 0, y: 0, width: 2000, height: 1200 } })).toEqual({
      lost: true
    })
  })

  it('is lost when a window in front covers the spot under the feet, not when it is beside', () => {
    const over = win({ x: 850, y: 550, width: 200, height: 200 }, { title: '' })
    const beside = win({ x: 1100, y: 550, width: 200, height: 200 })
    expect(follow(300, perch, [over])).toEqual({ lost: true })
    expect(follow(300, perch, [beside]).lost).toBe(false)
  })

  it('is lost when the edge leaves the area: too high for the cat, or below the floor', () => {
    expect(follow(300, { ...perch, rect: { ...perch.rect, y: 100 } })).toEqual({ lost: true })
    expect(follow(300, { ...perch, rect: { ...perch.rect, y: 1160 } })).toEqual({ lost: true })
  })
})
