import { describe, expect, it } from 'vitest'
import { cleanAlpha, findPieces, regridSheet, DEFAULT_REGRID } from './spriteRegrid.mts'
import type { RgbaImage } from './png.mts'

/** A blank RGBA image filled with hazy background alpha. */
function sheet(width: number, height: number, haze = 100): RgbaImage {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([240, 240, 240, haze], i)
  return { width, height, data }
}

function rect(img: RgbaImage, x0: number, y0: number, w: number, h: number, alpha = 251): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) img.data.set([200, 120, 60, alpha], (y * img.width + x) * 4)
  }
}

describe('cleanAlpha', () => {
  it('drops the haze, makes art solid and ramps between', () => {
    const img = sheet(3, 1)
    img.data[7] = 251
    img.data[11] = 222
    const out = cleanAlpha(img, 205, 240)
    expect([out.data[3], out.data[7], out.data[11]]).toEqual([0, 255, 124])
  })
})

describe('findPieces', () => {
  it('finds separate pieces (8-neighbour)', () => {
    const img = sheet(10, 10, 0)
    rect(img, 0, 0, 2, 2)
    rect(img, 2, 2, 1, 1) // touches diagonally: same piece
    rect(img, 6, 6, 3, 3)
    expect(
      findPieces(img)
        .map((p) => p.pixels.length)
        .sort((a, b) => a - b)
    ).toEqual([5, 9])
  })
})

describe('regridSheet', () => {
  // Two source cells 30 px wide; a frame whose sparkle crosses into the next cell.
  const opts = {
    ...DEFAULT_REGRID,
    columns: 2,
    rows: 1,
    cell: 40,
    feetY: 36,
    scale: 1,
    minPiece: 2
  }

  it('puts each frame in its own cell with the feet on one line, removing the haze', () => {
    const img = sheet(60, 30)
    rect(img, 5, 10, 10, 15) // frame 0 body, feet at y = 24
    rect(img, 27, 4, 4, 4) // frame 0 sparkle, crossing the old cell line at x = 30
    rect(img, 38, 6, 10, 12) // frame 1 body, feet at y = 17 (drawn higher)
    const { image, cells } = regridSheet(img, opts)
    expect(image.width).toBe(80)
    // The sparkle's centre (x = 28.5) is in old cell 0, so it stays with frame 0.
    expect(cells.map((c) => c.pieces)).toEqual([2, 1])
    expect(cells.every((c) => !c.clipped)).toBe(true)
    expect(cells.map((c) => c.box?.bottom)).toEqual([36, 36])
    // Haze is gone: the corner is fully transparent.
    expect(image.data[3]).toBe(0)
  })
})
