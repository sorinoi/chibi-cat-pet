import { describe, expect, it } from 'vitest'
import type { RgbaImage } from './png.mts'
import { dropShadows } from './shadows.mts'

const SHADOW = [200, 192, 184]
const WHITE = [248, 248, 240]
const OUTLINE = [8, 0, 0]
const GREY_RIM = [200, 196, 192] // anti-aliased edge between white and the outline

function blank(w: number, h: number): RgbaImage {
  return { width: w, height: h, data: new Uint8Array(w * h * 4) }
}
function fill(img: RgbaImage, x0: number, y0: number, w: number, h: number, rgb: number[]): void {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4)
}
const alphaAt = (img: RgbaImage, x: number, y: number): number =>
  img.data[(y * img.width + x) * 4 + 3] ?? 0

describe('dropShadows (requirement-v8.md FR-116)', () => {
  it('clears a flat grey ground shadow under a floating cat', () => {
    const img = blank(120, 80)
    fill(img, 30, 10, 40, 30, WHITE) // cat body
    fill(img, 20, 60, 60, 10, SHADOW) // shadow far below
    const out = dropShadows(img)
    expect(out.shadows).toBe(1)
    expect(alphaAt(out.image, 50, 65)).toBe(0)
    expect(alphaAt(out.image, 50, 20)).toBe(255)
  })

  it('clears a shadow touching the feet but not the fur behind the outline', () => {
    const img = blank(120, 80)
    fill(img, 30, 10, 40, 40, OUTLINE) // outline box
    fill(img, 32, 12, 36, 36, WHITE) // white fur inside
    fill(img, 15, 50, 90, 10, SHADOW) // shadow right under the outline
    const out = dropShadows(img)
    expect(out.shadows).toBe(1)
    expect(alphaAt(out.image, 20, 55)).toBe(0)
    expect(alphaAt(out.image, 50, 30)).toBe(255) // fur kept
    expect(alphaAt(out.image, 30, 49)).toBe(255) // outline kept
  })

  it('keeps thin grey rims and small grey bits', () => {
    const img = blank(120, 80)
    fill(img, 10, 10, 80, 2, GREY_RIM) // a long rim, 2 px tall
    fill(img, 10, 30, 8, 8, SHADOW) // a small square, not flat
    const out = dropShadows(img)
    expect(out.shadows).toBe(0)
    expect(alphaAt(out.image, 40, 11)).toBe(255)
    expect(alphaAt(out.image, 12, 32)).toBe(255)
  })
})
