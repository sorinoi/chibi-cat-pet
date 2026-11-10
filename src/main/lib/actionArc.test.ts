import { describe, expect, it } from 'vitest'
import { layoutActionArc, type ArcInput, type ArcLayout } from './actionArc'

const area = { x: 0, y: 0, width: 1600, height: 1000 }

function input(over: Partial<ArcInput> = {}): ArcInput {
  return {
    head: { x: 800, y: 800 },
    feet: { x: 800, y: 900 },
    area,
    count: 4,
    buttonSize: 40,
    radius: 90,
    spreadDeg: 140,
    centreInset: 0.1,
    edgeMargin: 4,
    maxTurnDeg: 75,
    turnStepDeg: 5,
    windowPad: 10,
    ...over
  }
}

/** Button centres back in screen DIP. */
const onScreen = (layout: ArcLayout): Array<{ x: number; y: number }> =>
  layout.buttons.map((b) => ({ x: b.x + layout.window.x, y: b.y + layout.window.y }))

function expectInside(layout: ArcLayout, i: ArcInput): void {
  const half = i.buttonSize / 2 + i.edgeMargin
  for (const p of onScreen(layout)) {
    expect(p.x - half).toBeGreaterThanOrEqual(i.area.x - 1e-6)
    expect(p.x + half).toBeLessThanOrEqual(i.area.x + i.area.width + 1e-6)
    expect(p.y - half).toBeGreaterThanOrEqual(i.area.y - 1e-6)
    expect(p.y + half).toBeLessThanOrEqual(i.area.y + i.area.height + 1e-6)
  }
}

describe('layoutActionArc (requirement-v9.md FR-124, FR-125)', () => {
  it('puts the buttons in a symmetric arc over the head, left to right', () => {
    const i = input()
    const layout = layoutActionArc(i)
    const pts = onScreen(layout)
    expect(layout.side).toBe('above')
    expect(layout.turnDeg).toBe(0)
    expect(pts).toHaveLength(4)
    // Left to right, mirrored around the head.
    for (let k = 1; k < pts.length; k++) expect(pts[k].x).toBeGreaterThan(pts[k - 1].x)
    expect(pts[0].x + pts[3].x).toBeCloseTo(2 * i.head.x)
    expect(pts[0].y).toBeCloseTo(pts[3].y)
    // An arc, not a row: the middle buttons are higher than the end ones, all above the head.
    expect(pts[1].y).toBeLessThan(pts[0].y)
    for (const p of pts) expect(p.y).toBeLessThan(i.head.y)
    expectInside(layout, i)
  })

  it('makes a window that holds every button with its padding', () => {
    const i = input()
    const layout = layoutActionArc(i)
    const reach = i.buttonSize / 2 + i.windowPad
    for (const b of layout.buttons) {
      expect(b.x - reach).toBeGreaterThanOrEqual(0)
      expect(b.y - reach).toBeGreaterThanOrEqual(0)
      expect(b.x + reach).toBeLessThanOrEqual(layout.window.width)
      expect(b.y + reach).toBeLessThanOrEqual(layout.window.height)
    }
    expect(Number.isInteger(layout.window.x) && Number.isInteger(layout.window.width)).toBe(true)
  })

  it('opens below the feet when there is no room above', () => {
    const i = input({ head: { x: 800, y: 30 }, feet: { x: 800, y: 130 } })
    const layout = layoutActionArc(i)
    expect(layout.side).toBe('below')
    for (const p of onScreen(layout)) expect(p.y).toBeGreaterThan(i.feet.y - i.radius * 0.5)
    const pts = onScreen(layout)
    // Opens downward: the middle buttons are lower than the end ones.
    expect(pts[1].y).toBeGreaterThan(pts[0].y)
    expectInside(layout, i)
  })

  it('turns toward the middle at the left edge', () => {
    const i = input({ head: { x: 60, y: 800 }, feet: { x: 60, y: 900 } })
    const layout = layoutActionArc(i)
    expect(layout.side).toBe('above')
    expect(layout.turnDeg).toBeGreaterThan(0)
    expectInside(layout, i)
  })

  it('turns toward the middle at the right edge', () => {
    const i = input({ head: { x: 1540, y: 800 }, feet: { x: 1540, y: 900 } })
    const layout = layoutActionArc(i)
    expect(layout.turnDeg).toBeLessThan(0)
    expectInside(layout, i)
  })

  it('shifts inside when turning is not enough (cat hanging past the edge)', () => {
    const i = input({ head: { x: -20, y: 800 }, feet: { x: -20, y: 900 } })
    const layout = layoutActionArc(i)
    expect(layout.turnDeg).toBe(i.maxTurnDeg)
    expectInside(layout, i)
  })

  it('fits in a top corner: below and turned', () => {
    const i = input({ head: { x: 40, y: 20 }, feet: { x: 40, y: 120 } })
    const layout = layoutActionArc(i)
    expect(layout.side).toBe('below')
    expect(layout.turnDeg).not.toBe(0)
    expectInside(layout, i)
  })

  it('works on a display that does not start at 0,0', () => {
    const second = { x: -1920, y: 200, width: 1920, height: 1040 }
    const i = input({ area: second, head: { x: -1900, y: 1000 }, feet: { x: -1900, y: 1100 } })
    expectInside(layoutActionArc(i), i)
  })

  it('handles three buttons (no cat adopted, FR-128)', () => {
    const i = input({ count: 3 })
    const pts = onScreen(layoutActionArc(i))
    expect(pts).toHaveLength(3)
    expect(pts[1].x).toBeCloseTo(i.head.x)
    expect(pts[1].y).toBeLessThan(pts[0].y)
  })
})
