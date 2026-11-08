/**
 * requirement-v5.md FR-76, section 8: climbing a screen edge. Pure (no Electron imports,
 * unit tested). All values in DIP.
 */
import type { Area, Rect, Size } from './placement'

export interface ClimbQuery {
  /** Pet window top-left now (standing on the floor). */
  x: number
  y: number
  size: Size
  /** Allowed positions on the display under the cat, and that display's work area. */
  area: Area
  work: Rect
  /**
   * Distance from the window's centre line to where the paws touch the wall (a wall on the
   * right; mirrored for the left), for the climb and hang pictures.
   */
  wallOffset: { climb: number; hang: number }
  /** How far to climb (chosen by the caller), and the least worth climbing. */
  rise: number
  minRise: number
}

export interface ClimbPlan {
  side: 'left' | 'right'
  /** Where the walk to the wall ends (inside the allowed area). */
  walkToX: number
  /**
   * Window x while climbing / holding on: the paws exactly on the work area's edge. The
   * window may hang past the area here; the art stops at the wall, so nothing shows on a
   * neighbouring display.
   */
  climbX: number
  holdX: number
  /** Window y where the cat stops and holds on. */
  topY: number
}

/**
 * FR-76: climb the nearer outer edge of the display the cat stands on, up to `rise` (but
 * never above the area). Null when there is not enough height to climb.
 */
export function planClimb(q: ClimbQuery): ClimbPlan | null {
  const half = q.size.width / 2
  const centerX = q.x + half
  const leftEdge = q.work.x
  const rightEdge = q.work.x + q.work.width
  const side = centerX - leftEdge <= rightEdge - centerX ? 'left' : 'right'
  const atWall = (offset: number): number =>
    Math.round(side === 'right' ? rightEdge - offset - half : leftEdge + offset - half)
  const climbX = atWall(q.wallOffset.climb)
  const topY = Math.round(Math.max(q.area.minY, q.y - q.rise))
  if (q.y - topY < q.minRise) return null
  return {
    side,
    walkToX: Math.min(Math.max(climbX, q.area.minX), q.area.maxX),
    climbX,
    holdX: atWall(q.wallOffset.hang),
    topY
  }
}

/** FR-76: a random climb height between two shares of the work area height. */
export function climbRise(
  workHeight: number,
  range: { minShare: number; maxShare: number },
  random: number
): number {
  return workHeight * (range.minShare + random * (range.maxShare - range.minShare))
}
