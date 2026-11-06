import { describe, expect, it } from 'vitest'
import { decodePng, encodePng, type RgbaImage } from './png.mts'
import { prepareSheet } from './spritePrep.mts'

function blank(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8Array(width * height * 4) }
}

function setAlpha(img: RgbaImage, x: number, y: number, a: number): void {
  const i = (y * img.width + x) * 4
  img.data[i] = 200
  img.data[i + 1] = 150
  img.data[i + 2] = 100
  img.data[i + 3] = a
}

const alphaAt = (img: RgbaImage, x: number, y: number): number =>
  img.data[(y * img.width + x) * 4 + 3]

const options = {
  columns: 2,
  rows: 1,
  solidFrom: 240,
  strayBelow: 32,
  strayMargin: 2,
  solidThreshold: 128
}

describe('png codec', () => {
  it('round-trips RGBA pixels exactly', () => {
    const img = blank(5, 3)
    for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 37) % 256
    const back = decodePng(encodePng(img))
    expect(back.width).toBe(5)
    expect(back.height).toBe(3)
    expect(Array.from(back.data)).toEqual(Array.from(img.data))
  })

  it('rejects files that are not PNG', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/PNG/)
  })
})

describe('prepareSheet', () => {
  it('makes near-opaque pixels solid and leaves soft edges alone', () => {
    const img = blank(8, 4)
    setAlpha(img, 1, 1, 253)
    setAlpha(img, 2, 1, 120)
    const report = prepareSheet(img, options)
    expect(alphaAt(img, 1, 1)).toBe(255)
    expect(alphaAt(img, 2, 1)).toBe(120)
    expect(report.madeSolid).toBe(1)
  })

  it('clears faint specks far from the art but keeps faint edge pixels next to it', () => {
    const img = blank(8, 4)
    setAlpha(img, 1, 1, 255)
    setAlpha(img, 2, 2, 10) // within 2 px of the solid pixel: anti-aliasing, keep
    setAlpha(img, 3, 3, 10) // 2 px away diagonally: still within the box margin, keep
    setAlpha(img, 7, 0, 10) // far away in the other cell: stray, clear
    const report = prepareSheet(img, options)
    expect(alphaAt(img, 2, 2)).toBe(10)
    expect(alphaAt(img, 3, 3)).toBe(10)
    expect(alphaAt(img, 7, 0)).toBe(0)
    expect(report.strayCleared).toBe(1)
  })

  it('reports each cell solid box in cell coordinates', () => {
    const img = blank(8, 4)
    setAlpha(img, 5, 1, 255)
    setAlpha(img, 6, 3, 255)
    const report = prepareSheet(img, options)
    expect(report.cellWidth).toBe(4)
    expect(report.cells[0].box).toBeNull()
    expect(report.cells[1].box).toEqual({ left: 1, top: 1, right: 2, bottom: 3 })
  })

  it('refuses sizes that do not split into the grid', () => {
    expect(() => prepareSheet(blank(7, 4), options)).toThrow(/split/)
  })
})
