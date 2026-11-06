/**
 * Rebuilds a sprite sheet that does not follow the sheet rules (requirement.md section 9)
 * into one that does: semi-transparent background haze removed, each frame cut out by its
 * own art (so pieces that cross the old grid lines stay with their frame), scaled, and
 * placed on a regular grid with every frame's feet on one line. Only existing pixels are
 * moved and resampled; nothing is drawn.
 */
import { resize } from './image.mts'
import type { RgbaImage } from './png.mts'

export interface RegridOptions {
  /** Grid of the source sheet (cells may be fractional, e.g. 271.5 px). */
  columns: number
  rows: number
  /** Output cell size in px (square) and the feet line inside it. */
  cell: number
  feetY: number
  /** Output size relative to the source art. */
  scale: number
  /** Alpha at or below `alphaFrom` becomes 0, at or above `alphaTo` becomes 255, ramp between. */
  alphaFrom: number
  alphaTo: number
  /** Pieces smaller than this many pixels are dropped as specks. */
  minPiece: number
  /** Alpha at or above this counts as solid when finding the feet. */
  solidThreshold: number
  /** Top share of the biggest piece used as the head, the horizontal anchor of each frame. */
  headShare: number
}

export const DEFAULT_REGRID: RegridOptions = {
  columns: 8,
  rows: 4,
  cell: 224,
  feetY: 210,
  scale: 1,
  alphaFrom: 205,
  alphaTo: 240,
  minPiece: 12,
  solidThreshold: 128,
  headShare: 0.35
}

export interface RegridCell {
  row: number
  column: number
  pieces: number
  /** Art box in the output cell (null if empty), and whether anything was cut off. */
  box: { left: number; top: number; right: number; bottom: number } | null
  clipped: boolean
}

/** Maps alpha through the from/to ramp (removes a hazy semi-transparent background). */
export function cleanAlpha(image: RgbaImage, from: number, to: number): RgbaImage {
  const data = new Uint8Array(image.data)
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]
    data[i] = a <= from ? 0 : a >= to ? 255 : Math.round(((a - from) / (to - from)) * 255)
  }
  return { width: image.width, height: image.height, data }
}

export interface Piece {
  pixels: number[]
  sumX: number
  sumY: number
}

/** Connected pieces of visible pixels (8-neighbour), so sparkles count as their own piece. */
export function findPieces(image: RgbaImage): Piece[] {
  const { width: W, height: H, data } = image
  const seen = new Uint8Array(W * H)
  const pieces: Piece[] = []
  const stack: number[] = []
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue
    const piece: Piece = { pixels: [], sumX: 0, sumY: 0 }
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const p = stack.pop() as number
      const x = p % W
      const y = (p - x) / W
      piece.pixels.push(p)
      piece.sumX += x
      piece.sumY += y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (!seen[n] && data[n * 4 + 3] > 0) {
            seen[n] = 1
            stack.push(n)
          }
        }
      }
    }
    pieces.push(piece)
  }
  return pieces
}

/** Mean x of the top `share` of the biggest piece: the head, a steady anchor across poses. */
export function headCentreX(pieces: readonly Piece[], width: number, share: number): number {
  const biggest = pieces.reduce((a, b) => (b.pixels.length > a.pixels.length ? b : a))
  let top = Infinity
  let bottom = -Infinity
  for (const p of biggest.pixels) {
    const y = Math.floor(p / width)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  const limit = top + (bottom - top) * share
  let sum = 0
  let count = 0
  for (const p of biggest.pixels) {
    if (Math.floor(p / width) > limit) continue
    sum += p % width
    count++
  }
  return count ? sum / count : biggest.sumX / biggest.pixels.length
}

export function regridSheet(
  source: RgbaImage,
  options: RegridOptions = DEFAULT_REGRID
): { image: RgbaImage; cells: RegridCell[] } {
  const o = options
  const clean = cleanAlpha(source, o.alphaFrom, o.alphaTo)
  const W = clean.width
  const cellW = clean.width / o.columns
  const cellH = clean.height / o.rows

  // Each piece belongs to the source cell that holds its centre.
  const byCell = new Map<number, Piece[]>()
  for (const piece of findPieces(clean)) {
    if (piece.pixels.length < o.minPiece) continue
    const cx = piece.sumX / piece.pixels.length
    const cy = piece.sumY / piece.pixels.length
    const col = Math.min(o.columns - 1, Math.floor(cx / cellW))
    const row = Math.min(o.rows - 1, Math.floor(cy / cellH))
    const key = row * o.columns + col
    byCell.set(key, [...(byCell.get(key) ?? []), piece])
  }

  const outW = o.columns * o.cell
  const outH = o.rows * o.cell
  const out = new Uint8Array(outW * outH * 4)
  const cells: RegridCell[] = []

  for (let row = 0; row < o.rows; row++) {
    const placed: Array<{ report: RegridCell; scaled: RgbaImage; left: number; top: number }> = []
    for (let column = 0; column < o.columns; column++) {
      const pieces = byCell.get(row * o.columns + column) ?? []
      const report: RegridCell = { row, column, pieces: pieces.length, box: null, clipped: false }
      cells.push(report)
      if (pieces.length === 0) continue

      // Bounding box of the frame's pieces, and its feet (lowest solid pixel).
      let left = Infinity
      let top = Infinity
      let right = -Infinity
      let bottom = -Infinity
      let feet = -Infinity
      for (const piece of pieces) {
        for (const p of piece.pixels) {
          const x = p % W
          const y = (p - x) / W
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
          if (clean.data[p * 4 + 3] >= o.solidThreshold) feet = Math.max(feet, y)
        }
      }
      if (!Number.isFinite(feet)) feet = bottom

      // Copy only this frame's pieces into a crop, then scale it.
      const cropW = right - left + 1
      const cropH = bottom - top + 1
      const crop = new Uint8Array(cropW * cropH * 4)
      for (const piece of pieces) {
        for (const p of piece.pixels) {
          const x = p % W
          const y = (p - x) / W
          crop.set(clean.data.subarray(p * 4, p * 4 + 4), ((y - top) * cropW + (x - left)) * 4)
        }
      }
      const scaled = resize({ width: cropW, height: cropH, data: crop }, o.scale)
      const sx = scaled.width / cropW
      const sy = scaled.height / cropH

      // Horizontal anchor: the cat's head (top part of the biggest piece), so the cat stays put
      // even when the source frames were not evenly spaced or props widen the frame. The row
      // is centred below. Feet go on feetY.
      const anchorX = headCentreX(pieces, W, o.headShare)
      placed.push({
        report,
        scaled,
        left: Math.round(o.cell / 2 - (anchorX - left) * sx),
        top: Math.round(o.feetY - (feet - top) * sy)
      })
    }

    // One horizontal shift for the whole row: centre the union of its frames in the cell.
    const rowLeft = Math.min(...placed.map((f) => f.left))
    const rowRight = Math.max(...placed.map((f) => f.left + f.scaled.width))
    const shift = placed.length ? Math.round((o.cell - (rowLeft + rowRight)) / 2) : 0

    for (const { report, scaled, left: placedLeft, top: destTop } of placed) {
      const { column } = report
      const destLeft = placedLeft + shift
      let bl = Infinity
      let bt = Infinity
      let br = -Infinity
      let bb = -Infinity
      for (let y = 0; y < scaled.height; y++) {
        for (let x = 0; x < scaled.width; x++) {
          const s = (y * scaled.width + x) * 4
          if (scaled.data[s + 3] === 0) continue
          const cx = destLeft + x
          const cy = destTop + y
          if (cx < 0 || cy < 0 || cx >= o.cell || cy >= o.cell) {
            report.clipped = true
            continue
          }
          bl = Math.min(bl, cx)
          br = Math.max(br, cx)
          bt = Math.min(bt, cy)
          bb = Math.max(bb, cy)
          const d = ((row * o.cell + cy) * outW + column * o.cell + cx) * 4
          out.set(scaled.data.subarray(s, s + 4), d)
        }
      }
      if (Number.isFinite(bl)) report.box = { left: bl, top: bt, right: br, bottom: bb }
    }
  }
  return { image: { width: outW, height: outH, data: out }, cells }
}
