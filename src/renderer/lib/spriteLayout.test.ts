import { describe, expect, it } from 'vitest'
import { spriteLayout, toCell } from './spriteLayout'

const main = { anchor: { x: 96, y: 177 }, scale: 1 }
const care = { anchor: { x: 112, y: 210 }, scale: 1 }
const single = { width: 192, height: 192, feetX: 96, feetY: 177 }
const both = { width: 224, height: 225, feetX: 112, feetY: 210 }

/** Where a sheet's feet anchor lands on the canvas. */
function feetOnCanvas(l: ReturnType<typeof spriteLayout>, sheet: typeof main): [number, number] {
  return [l.originX + l.sign * l.scale * sheet.anchor.x, l.originY + l.scale * sheet.anchor.y]
}

describe('spriteLayout', () => {
  it('fills a matching canvas 1:1', () => {
    const l = spriteLayout(192, 192, single, main, false)
    expect(l).toEqual({ scale: 1, sign: 1, originX: 0, originY: 0 })
    expect(toCell(l, 50, 60)).toEqual({ u: 50, v: 60 })
  })

  it('scales with the canvas (DPI, pet size) and keeps the feet in place', () => {
    const l = spriteLayout(240, 240, single, main, false)
    expect(l.scale).toBe(1.25)
    expect(feetOnCanvas(l, main)).toEqual([120, 177 * 1.25])
  })

  it('puts the feet of different sheets on the same canvas point', () => {
    const a = spriteLayout(280, 281.25, both, main, false)
    const b = spriteLayout(280, 281.25, both, care, false)
    expect(feetOnCanvas(a, main)).toEqual(feetOnCanvas(b, care))
    expect(feetOnCanvas(b, care)).toEqual([140, 262.5])
  })

  it('mirrors around the feet', () => {
    const l = spriteLayout(192, 192, single, main, true)
    // A point 10 px right of the anchor in the sheet shows 10 px left of it on screen.
    expect(l.originX + l.sign * l.scale * 106).toBe(86)
    expect(toCell(l, 86, 0).u).toBe(106)
  })

  it('applies the sheet scale on top of the fit', () => {
    const l = spriteLayout(192, 192, single, { ...main, scale: 0.5 }, false)
    expect(l.scale).toBe(0.5)
    expect(feetOnCanvas(l, { ...main, scale: 0.5 })).toEqual([96, 177])
  })

  it('letterboxes a wider canvas without stretching', () => {
    const l = spriteLayout(400, 192, single, main, false)
    expect(l.scale).toBe(1)
    expect(toCell(l, 200, 0).u).toBe(96)
  })
})
