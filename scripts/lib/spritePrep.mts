import type { RgbaImage } from './png.mts'

export interface PrepOptions {
  columns: number
  rows: number
  /** Alpha at or above this becomes 255 (near-opaque art -> solid). */
  solidFrom: number
  /** Pixels with alpha below this ... */
  strayBelow: number
  /** ... that are farther than this (px) from any solid pixel are cleared. */
  strayMargin: number
  /** Alpha at or above this counts as "solid" when finding the art and its feet. */
  solidThreshold: number
}

export const DEFAULT_PREP: PrepOptions = {
  columns: 8,
  rows: 4,
  solidFrom: 240,
  strayBelow: 32,
  strayMargin: 3,
  solidThreshold: 128
}

export interface CellReport {
  row: number
  column: number
  /** Solid-pixel box in cell coordinates, or null for an empty cell. */
  box: { left: number; top: number; right: number; bottom: number } | null
}

export interface PrepReport {
  cellWidth: number
  cellHeight: number
  madeSolid: number
  strayCleared: number
  cells: CellReport[]
}

/**
 * Cleans a sprite sheet in place: makes near-opaque pixels fully opaque and clears faint
 * specks far from the art (leftovers of background removal). Anti-aliased edges next to
 * the art are kept. Returns what changed plus each cell's solid box.
 */
export function prepareSheet(image: RgbaImage, options: PrepOptions = DEFAULT_PREP): PrepReport {
  const { width, height, data } = image
  if (width % options.columns || height % options.rows) {
    throw new Error(
      `${width}x${height} does not split into ${options.columns}x${options.rows} cells`
    )
  }
  const cellWidth = width / options.columns
  const cellHeight = height / options.rows

  let madeSolid = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= options.solidFrom && data[i] < 255) {
      data[i] = 255
      madeSolid++
    }
  }

  // Solid mask dilated by strayMargin (separable box dilation: rows, then columns).
  const solid = new Uint8Array(width * height)
  for (let p = 0; p < solid.length; p++)
    solid[p] = data[p * 4 + 3] >= options.solidThreshold ? 1 : 0
  const m = options.strayMargin
  const horizontal = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0
      for (let dx = -m; dx <= m && !hit; dx++) {
        const xx = x + dx
        if (xx >= 0 && xx < width && solid[y * width + xx]) hit = 1
      }
      horizontal[y * width + x] = hit
    }
  }
  let strayCleared = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const a = data[p * 4 + 3]
      if (a === 0 || a >= options.strayBelow) continue
      let near = false
      for (let dy = -m; dy <= m && !near; dy++) {
        const yy = y + dy
        if (yy >= 0 && yy < height && horizontal[yy * width + x]) near = true
      }
      if (!near) {
        data[p * 4 + 3] = 0
        strayCleared++
      }
    }
  }

  const cells: CellReport[] = []
  for (let row = 0; row < options.rows; row++) {
    for (let column = 0; column < options.columns; column++) {
      let left = Infinity
      let top = Infinity
      let right = -1
      let bottom = -1
      for (let y = 0; y < cellHeight; y++) {
        for (let x = 0; x < cellWidth; x++) {
          if (!solid[(row * cellHeight + y) * width + column * cellWidth + x]) continue
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
      cells.push({ row, column, box: right < 0 ? null : { left, top, right, bottom } })
    }
  }
  return { cellWidth, cellHeight, madeSolid, strayCleared, cells }
}
