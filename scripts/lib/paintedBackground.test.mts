import { describe, expect, it } from 'vitest'
import { clearPaintedBackground } from './paintedBackground.mts'
import type { RgbaImage } from './png.mts'

const SQUARE = 4

/** An opaque image with a painted 254/244 checkerboard of 4 px squares. */
function checkerboard(width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = (Math.floor(x / SQUARE) + Math.floor(y / SQUARE)) % 2 === 0 ? 254 : 244
      data.set([v, v, v, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

function paint(img: RgbaImage, x0: number, y0: number, w: number, h: number, rgb: number[]): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4)
  }
}

/** A solid dark block standing in for outlined art. */
function outlined(img: RgbaImage, x0: number, y0: number, w: number, h: number): void {
  paint(img, x0, y0, w, h, [20, 20, 20])
}

const alphaAt = (img: RgbaImage, x: number, y: number): number =>
  img.data[(y * img.width + x) * 4 + 3]

describe('clearPaintedBackground', () => {
  it('keeps solid outline pixels next to the background fully opaque', () => {
    const img = checkerboard(30, 30)
    outlined(img, 10, 10, 10, 10)
    const { image, fringe } = clearPaintedBackground(img)
    expect(fringe).toBe(0)
    expect(alphaAt(image, 10, 10)).toBe(255)
  })

  it('clears the painted checkerboard around the art', () => {
    const img = checkerboard(40, 40)
    outlined(img, 10, 10, 20, 20)
    const { image, cleared } = clearPaintedBackground(img)
    expect(alphaAt(image, 0, 0)).toBe(0)
    expect(alphaAt(image, 39, 39)).toBe(0)
    expect(alphaAt(image, 20, 20)).toBe(255)
    expect(cleared).toBe(40 * 40 - 20 * 20)
  })

  it('keeps white and two-tone fill inside a closed outline, even in the same greys', () => {
    const img = checkerboard(40, 40)
    outlined(img, 8, 8, 24, 24)
    paint(img, 11, 11, 18, 9, [254, 254, 254]) // highlight
    paint(img, 11, 20, 18, 9, [237, 237, 237]) // shading
    const { image } = clearPaintedBackground(img)
    expect(alphaAt(image, 15, 15)).toBe(255)
    expect(alphaAt(image, 15, 25)).toBe(255)
  })

  it('leaves background enclosed by the art alone (it cannot be told from white fill)', () => {
    const img = checkerboard(48, 48)
    outlined(img, 6, 6, 36, 36)
    const window = checkerboard(48, 48)
    for (let y = 16; y < 32; y++) {
      for (let x = 16; x < 32; x++) {
        const i = (y * 48 + x) * 4
        img.data.set(window.data.subarray(i, i + 4), i)
      }
    }
    const { image } = clearPaintedBackground(img)
    expect(alphaAt(image, 20, 20)).toBe(255)
    expect(alphaAt(image, 0, 0)).toBe(0)
  })

  it('turns grey edge pixels into partly transparent dark pixels', () => {
    const img = checkerboard(30, 30)
    outlined(img, 10, 10, 10, 10)
    paint(img, 9, 10, 1, 10, [125, 125, 125]) // anti-aliased edge, half way to the background
    const { image, fringe } = clearPaintedBackground(img)
    expect(fringe).toBe(10)
    const i = (15 * 30 + 9) * 4
    expect(image.data[i + 3]).toBe(145) // (250 - 125) / (250 - 30)
    expect(image.data[i]).toBe(30) // the outline colour under the blend
  })

  it('leaves coloured art and colourful light pixels alone', () => {
    const img = checkerboard(30, 30)
    paint(img, 10, 10, 10, 10, [255, 220, 40]) // yellow marks
    const { image } = clearPaintedBackground(img)
    expect(alphaAt(image, 15, 15)).toBe(255)
    expect(image.data[(15 * 30 + 15) * 4 + 1]).toBe(220)
  })
})
