import { describe, expect, it } from 'vitest'
import type { RgbaImage } from './png.mts'
import { coatWeight, LOOK_PRESETS, recolorCoat } from './recolor.mts'

/** One pixel per color, in a row. */
function strip(colors: Array<[number, number, number, number]>): RgbaImage {
  const data = new Uint8Array(colors.length * 4)
  colors.forEach((c, i) => data.set(c, i * 4))
  return { width: colors.length, height: 1, data }
}
const px = (img: RgbaImage, i: number): number[] => [...img.data.slice(i * 4, i * 4 + 4)]

// Colors measured in cat-care.png (2026-11-08).
const COAT = [248, 192, 136, 255] as [number, number, number, number] // orange patch
const CREAM = [248, 240, 232, 255] as [number, number, number, number]
const OUTLINE = [16, 0, 0, 255] as [number, number, number, number]
const PINK = [248, 216, 208, 255] as [number, number, number, number] // ears, cheeks
const RED = [248, 104, 96, 255] as [number, number, number, number] // bowl, collar
const YELLOW = [240, 200, 24, 255] as [number, number, number, number] // bell, sparkles
const CLEAR = [248, 192, 136, 0] as [number, number, number, number]

describe('coat recolor (requirement-v7.md FR-105)', () => {
  it('finds the orange coat and nothing else', () => {
    expect(coatWeight(248, 192, 136)).toBe(1)
    for (const [r, g, b] of [CREAM, OUTLINE, PINK, RED, YELLOW]) expect(coatWeight(r, g, b)).toBe(0)
  })

  it('turns the coat gray with its shading kept, and leaves the rest alone', () => {
    const img = strip([COAT, CREAM, OUTLINE, PINK, RED, YELLOW, CLEAR, [200, 140, 80, 255]])
    const changed = recolorCoat(img, LOOK_PRESETS['gray']!)
    expect(changed).toBe(2)
    const [r, g, b] = px(img, 0) as [number, number, number]
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20) // nearly gray
    const dark = px(img, 7).slice(0, 3)
    expect(Math.max(...dark)).toBeLessThan(Math.max(r, g, b)) // a darker stripe stays darker
    expect(px(img, 1)).toEqual(CREAM)
    expect(px(img, 2)).toEqual(OUTLINE)
    expect(px(img, 3)).toEqual(PINK)
    expect(px(img, 4)).toEqual(RED)
    expect(px(img, 5)).toEqual(YELLOW)
    expect(px(img, 6)).toEqual(CLEAR) // transparent pixels are never touched
  })

  it('changes a soft edge only partly', () => {
    const edge = strip([[230, 200, 170, 255]]) // between orange and cream
    const w = coatWeight(230, 200, 170)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(1)
    recolorCoat(edge, LOOK_PRESETS['black']!)
    const [r] = px(edge, 0) as [number, number, number]
    expect(r).toBeGreaterThan(80) // not fully black
  })
})
