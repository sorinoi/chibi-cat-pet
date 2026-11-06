import type { ModelFrame, SpriteSheet } from '../../shared/modelConfig'

/**
 * Maps cell pixels of one sheet to canvas pixels:
 * x = originX + sign * scale * u, y = originY + scale * v.
 * The model frame is fitted uniformly into the canvas (bottom aligned, centered), and the
 * sheet's feet anchor lands on the frame's feet point, so switching sheets never moves the
 * feet. Mirroring flips around the feet, so the cat turns in place.
 */
export interface SpriteLayout {
  scale: number
  /** -1 when mirrored, 1 otherwise. */
  sign: 1 | -1
  originX: number
  originY: number
}

export function spriteLayout(
  canvasWidth: number,
  canvasHeight: number,
  frame: ModelFrame,
  sheet: Pick<SpriteSheet, 'anchor' | 'scale'>,
  mirrored: boolean
): SpriteLayout {
  const fit = Math.min(canvasWidth / frame.width, canvasHeight / frame.height)
  const feetX = (canvasWidth - frame.width * fit) / 2 + frame.feetX * fit
  const feetY = canvasHeight - frame.height * fit + frame.feetY * fit
  const scale = fit * sheet.scale
  const sign = mirrored ? -1 : 1
  return {
    scale,
    sign,
    originX: feetX - sign * sheet.anchor.x * scale,
    originY: feetY - sheet.anchor.y * scale
  }
}

/** Canvas pixel -> cell pixel (inverse of the layout). May fall outside the cell. */
export function toCell(layout: SpriteLayout, x: number, y: number): { u: number; v: number } {
  return {
    u: (x - layout.originX) / (layout.sign * layout.scale),
    v: (y - layout.originY) / layout.scale
  }
}
