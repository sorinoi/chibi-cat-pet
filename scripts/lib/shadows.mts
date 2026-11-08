/**
 * requirement-v8.md FR-116: removes ground shadows drawn under the cat (flat, light, neutral
 * grey ellipses). The app moves the cat itself, so a shadow drawn in the frame would float
 * along. A region starts at shadow-coloured pixels, grows through pale neutral pixels (it cannot
 * cross the cat's dark outline), and is cleared only when it is big, flat and at least a few
 * pixels tall, so thin anti-aliased rims along the outline stay. Only alpha changes.
 */
import type { RgbaImage } from './png.mts'

export interface ShadowOptions {
  /** HSV value range (0..1) and top chroma of shadow pixels (where a region starts). */
  seedValue: { min: number; max: number }
  seedChroma: number
  /** Pale neutral pixels a region may grow through (soft shadow edges). */
  growValue: number
  growChroma: number
  /** A region is a shadow only when this big, this tall and this flat (width / height). */
  minPixels: number
  minHeight: number
  minFlatness: number
}

/** Measured on cat-jump.png (2026-11-08): shadows #c8c0b8..#d0c8c0, white fur value > 0.94. */
export const DEFAULT_SHADOWS: ShadowOptions = {
  seedValue: { min: 0.68, max: 0.9 },
  seedChroma: 0.1,
  growValue: 0.6,
  growChroma: 0.12,
  minPixels: 150,
  minHeight: 5,
  minFlatness: 2.5
}

function hsv(d: Uint8Array, i: number): { c: number; v: number } {
  const r = d[i] ?? 0
  const g = d[i + 1] ?? 0
  const b = d[i + 2] ?? 0
  const max = Math.max(r, g, b)
  return { c: (max - Math.min(r, g, b)) / 255, v: max / 255 }
}

export function dropShadows(
  source: RgbaImage,
  o: ShadowOptions = DEFAULT_SHADOWS
): { image: RgbaImage; shadows: number; cleared: number } {
  const { width: W, height: H } = source
  const data = new Uint8Array(source.data)
  const seen = new Uint8Array(W * H)
  const isSeed = (p: number): boolean => {
    if ((data[p * 4 + 3] ?? 0) === 0) return false
    const { c, v } = hsv(data, p * 4)
    return c <= o.seedChroma && v >= o.seedValue.min && v <= o.seedValue.max
  }
  const canGrow = (p: number): boolean => {
    if ((data[p * 4 + 3] ?? 0) === 0) return false
    const { c, v } = hsv(data, p * 4)
    return c <= o.growChroma && v >= o.growValue
  }
  let shadows = 0
  let cleared = 0
  const stack: number[] = []
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !isSeed(start)) continue
    const region: number[] = []
    let left = W
    let right = -1
    let top = H
    let bottom = -1
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const p = stack.pop() as number
      const x = p % W
      const y = (p - x) / W
      region.push(p)
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (!seen[n] && canGrow(n)) {
            seen[n] = 1
            stack.push(n)
          }
        }
      }
    }
    const w = right - left + 1
    const h = bottom - top + 1
    if (region.length < o.minPixels || h < o.minHeight || w < h * o.minFlatness) continue
    for (const p of region) data[p * 4 + 3] = 0
    shadows++
    cleared += region.length
  }
  return { image: { width: W, height: H, data }, shadows, cleared }
}
