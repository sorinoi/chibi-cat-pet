import { describe, expect, it } from 'vitest'
import { spriteLayout, toCell } from './spriteLayout'

const model = {
  sheet: { columns: 8, rows: 6, cellWidth: 192, cellHeight: 192 },
  anchor: { x: 96, y: 177 }
}

describe('spriteLayout', () => {
  it('fills a matching canvas 1:1', () => {
    const l = spriteLayout(192, 192, model, false)
    expect(l).toEqual({ scale: 1, sign: 1, originX: 0, originY: 0 })
    expect(toCell(l, 50, 60)).toEqual({ u: 50, v: 60 })
  })

  it('scales with the canvas (DPI, pet size) and keeps the feet bottom-center', () => {
    const l = spriteLayout(240, 240, model, false)
    expect(l.scale).toBe(1.25)
    // The anchor (96, 177) lands at the horizontal center.
    expect(l.originX + l.scale * model.anchor.x).toBe(120)
    expect(toCell(l, 120, 240)).toEqual({ u: 96, v: 192 })
  })

  it('mirrors around the anchor', () => {
    const l = spriteLayout(192, 192, model, true)
    // A point 10 px right of the anchor in the sheet shows 10 px left of it on screen.
    expect(l.originX + l.sign * l.scale * 106).toBe(86)
    expect(toCell(l, 86, 0).u).toBe(106)
  })

  it('letterboxes a wider canvas without stretching', () => {
    const l = spriteLayout(400, 192, model, false)
    expect(l.scale).toBe(1)
    expect(l.originY).toBe(0)
    expect(toCell(l, 200, 0).u).toBe(96)
  })
})
