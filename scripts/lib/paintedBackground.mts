/**
 * Turns a painted "transparent" background (a light grey checkerboard drawn into an opaque
 * image, as some image generators export) into real transparency, so the sheet can go
 * through the regrid. The art must have a closed dark outline, like the cat stickers:
 *
 * 1. Background is filled from the image border over light, colourless pixels. The fill
 *    stops at the outline, so the art's own white fill (often the same greys) is kept.
 * 2. Grey edge pixels next to the cleared area get alpha as if they were blended over the
 *    background, so no light halo is left.
 *
 * Background enclosed by the art (a gap between an arm and the head) is not reached and
 * stays: telling it from the art's own white fill proved unreliable (generators blend the
 * checker into light fill too). Check the result over a dark background.
 *
 * Only existing pixels change; nothing is drawn.
 */
import type { RgbaImage } from './png.mts'

export interface PaintedBackgroundOptions {
  /** Light and nearly colourless (max - min channel) pixels count as background-like. */
  minValue: number
  maxSpread: number
  /** Edge pixels within this many px of the cleared area are un-blended. */
  fringe: number
  /** Edge pixels up to this colour spread are treated as grey blends of the outline. */
  fringeMaxSpread: number
  /** The background value the edge pixels were blended with. */
  backgroundValue: number
  /** The outline's own value: pixels this dark or darker are solid art, not blends. */
  outlineValue: number
}

export const DEFAULT_PAINTED_BACKGROUND: PaintedBackgroundOptions = {
  minValue: 236,
  maxSpread: 8,
  fringe: 2,
  fringeMaxSpread: 16,
  backgroundValue: 250,
  outlineValue: 30
}

export interface PaintedBackgroundReport {
  image: RgbaImage
  /** Pixels made transparent. */
  cleared: number
  /** Edge pixels given partial alpha. */
  fringe: number
}

export function clearPaintedBackground(
  source: RgbaImage,
  options: PaintedBackgroundOptions = DEFAULT_PAINTED_BACKGROUND
): PaintedBackgroundReport {
  const { width, height } = source
  const data = new Uint8Array(source.data)
  const count = width * height
  const value = new Float32Array(count)
  const spread = new Uint8Array(count)
  const bgLike = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    value[i] = (r + g + b) / 3
    spread[i] = Math.max(r, g, b) - Math.min(r, g, b)
    bgLike[i] = value[i] >= options.minValue && spread[i] <= options.maxSpread ? 1 : 0
  }

  const cleared = new Uint8Array(count)
  const stack: number[] = []
  /** 4-neighbour fill over background-like pixels. */
  const fill = (seed: number, mark: Uint8Array): void => {
    stack.push(seed)
    mark[seed] = 1
    while (stack.length > 0) {
      const i = stack.pop() as number
      const x = i % width
      const y = (i - x) / width
      const next = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1
      ]
      for (const n of next) {
        if (n >= 0 && bgLike[n] && !mark[n]) {
          mark[n] = 1
          stack.push(n)
        }
      }
    }
  }

  // 1. Outer background, from every border pixel.
  for (let x = 0; x < width; x++) {
    for (const i of [x, (height - 1) * width + x]) if (bgLike[i] && !cleared[i]) fill(i, cleared)
  }
  for (let y = 0; y < height; y++) {
    for (const i of [y * width, y * width + width - 1])
      if (bgLike[i] && !cleared[i]) fill(i, cleared)
  }

  // 2. Un-blend grey edge pixels near the cleared area (8-neighbour distance).
  let fringe = 0
  let near = new Uint8Array(cleared)
  for (let step = 0; step < options.fringe; step++) {
    const grown = new Uint8Array(near)
    for (let i = 0; i < count; i++) {
      if (!near[i]) continue
      const x = i % width
      const y = (i - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) grown[ny * width + nx] = 1
        }
      }
    }
    near = grown
  }
  const bg = options.backgroundValue
  for (let i = 0; i < count; i++) {
    if (cleared[i] || !near[i] || spread[i] > options.fringeMaxSpread) continue
    if (value[i] >= options.minValue || value[i] <= options.outlineValue) continue
    const a = Math.min(1, Math.max(0, (bg - value[i]) / (bg - options.outlineValue)))
    for (let c = 0; c < 3; c++) {
      const observed = data[i * 4 + c]
      data[i * 4 + c] =
        a > 0 ? Math.min(255, Math.max(0, Math.round((observed - (1 - a) * bg) / a))) : 0
    }
    data[i * 4 + 3] = Math.round(a * 255)
    fringe++
  }

  let clearedCount = 0
  for (let i = 0; i < count; i++) {
    if (!cleared[i]) continue
    data.set([0, 0, 0, 0], i * 4)
    clearedCount++
  }
  return { image: { width, height, data }, cleared: clearedCount, fringe }
}
