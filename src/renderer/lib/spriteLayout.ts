import type { ModelConfig } from '../../shared/modelConfig'

/**
 * Maps cell pixels to canvas pixels: x = originX + sign * scale * u, y = originY + scale * v.
 * The cell is scaled uniformly to fit, its feet anchor sits at the horizontal center, and the
 * cell bottom touches the canvas bottom. Mirroring flips around the anchor, so the cat turns
 * in place.
 */
export interface SpriteLayout {
  scale: number
  /** -1 when mirrored, 1 otherwise. */
  sign: 1 | -1
  originX: number
  originY: number
}

type Geometry = Pick<ModelConfig, 'sheet' | 'anchor'>

export function spriteLayout(
  canvasWidth: number,
  canvasHeight: number,
  model: Geometry,
  mirrored: boolean
): SpriteLayout {
  const { cellWidth, cellHeight } = model.sheet
  const scale = Math.min(canvasWidth / cellWidth, canvasHeight / cellHeight)
  const sign = mirrored ? -1 : 1
  return {
    scale,
    sign,
    originX: canvasWidth / 2 - sign * model.anchor.x * scale,
    originY: canvasHeight - cellHeight * scale
  }
}

/** Canvas pixel -> cell pixel (inverse of the layout). May fall outside the cell. */
export function toCell(layout: SpriteLayout, x: number, y: number): { u: number; v: number } {
  return {
    u: (x - layout.originX) / (layout.sign * layout.scale),
    v: (y - layout.originY) / layout.scale
  }
}
