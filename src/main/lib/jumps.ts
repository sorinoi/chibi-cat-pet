/**
 * requirement-v5.md FR-73..75: where the cat can jump, and the arc it follows. Pure (no
 * Electron or native imports, unit tested). All values in DIP.
 */
import { edgeCovered, isPerch, perchWalkArea, type DesktopWindow } from './ledges'
import type { Area, Rect, Size } from './placement'

export interface Point {
  x: number
  y: number
}

export interface JumpQuery {
  /** Pet window top-left now. */
  x: number
  y: number
  size: Size
  /** Pet window y -> feet line. */
  feetOffset: number
  footHalfWidth: number
  minPerchWidth: number
  edgeMargin: number
  /** Allowed positions on the display under the cat. */
  area: Area
  /** FR-73: how high (feet to edge) and how far sideways a jump up may reach. */
  minRise: number
  maxRise: number
  maxSide: number
}

export interface JumpUpTarget {
  /** Pet window top-left on the edge. */
  x: number
  y: number
  perchId: number
  perchRect: Rect
}

const right = (r: Rect): number => r.x + r.width

/**
 * FR-73: every perch edge the cat can jump up to: above its feet by minRise..maxRise, the
 * nearest walkable spot on it within maxSide sideways, room above it, and the part under
 * the cat there not covered by a window in front. `windows` is front-most first.
 */
export function jumpUpTargets(
  q: JumpQuery,
  windows: readonly DesktopWindow[],
  displays: readonly Rect[]
): JumpUpTarget[] {
  const feet = q.y + q.feetOffset
  const targets: JumpUpTarget[] = []
  windows.forEach((w, index) => {
    if (!isPerch(w, displays, q.minPerchWidth)) return
    const edge = w.rect.y
    const rise = feet - edge
    if (rise < q.minRise || rise > q.maxRise) return
    const walk = perchWalkArea(q.area, w.rect, q.size, q.edgeMargin)
    const x = Math.min(Math.max(q.x, walk.minX), walk.maxX)
    if (Math.abs(x - q.x) > q.maxSide) return
    const y = edge - q.feetOffset
    if (y < q.area.minY) return
    const centerX = x + q.size.width / 2
    if (centerX < w.rect.x || centerX >= right(w.rect)) return
    const span = q.footHalfWidth
    if (edgeCovered(windows.slice(0, index), edge, centerX - span, centerX + span)) return
    targets.push({ x: Math.round(x), y: Math.round(y), perchId: w.id, perchRect: w.rect })
  })
  return targets
}

/**
 * FR-75: the spot just past one end of the perch, at the same height, from where the cat
 * falls. The nearer end first; an end whose spot is off the screen area is skipped.
 */
export function jumpDownSpot(q: JumpQuery, perch: Rect, clearance: number): Point | null {
  const centerX = q.x + q.size.width / 2
  const ends = [perch.x - clearance, right(perch) + clearance].sort(
    (a, b) => Math.abs(a - centerX) - Math.abs(b - centerX)
  )
  for (const endCenter of ends) {
    const x = endCenter - q.size.width / 2
    if (x >= q.area.minX && x <= q.area.maxX) return { x: Math.round(x), y: q.y }
  }
  return null
}

/** True when the cat stands at (or within `slack` of) either end of its walkable stretch. */
export function atPerchEnd(q: JumpQuery, perch: Rect, slack: number): boolean {
  const walk = perchWalkArea(q.area, perch, q.size, q.edgeMargin)
  return q.x <= walk.minX + slack || q.x >= walk.maxX - slack
}

export type JumpPlan =
  { kind: 'up'; to: Point; perchId: number; perchRect: Rect } | { kind: 'down'; to: Point }

/**
 * FR-73, FR-75: which jump to make. At the end of a perch the cat jumps down; on a perch
 * elsewhere it jumps up or down by chance; on the floor only up. Null when nothing fits.
 */
export function chooseJump(
  up: readonly JumpUpTarget[],
  down: Point | null,
  atEnd: boolean,
  random: () => number
): JumpPlan | null {
  if (down && (atEnd || up.length === 0 || random() < 0.5)) return { kind: 'down', to: down }
  if (up.length === 0) return null
  const t = up[Math.min(up.length - 1, Math.floor(random() * up.length))]
  return { kind: 'up', to: { x: t.x, y: t.y }, perchId: t.perchId, perchRect: t.perchRect }
}

/**
 * The arc between two points at progress t (0..1): x moves evenly, y follows a parabola
 * whose top is `lift` above the higher end.
 */
export function arcPoint(from: Point, to: Point, lift: number, t: number): Point {
  const p = Math.min(1, Math.max(0, t))
  const top = Math.min(from.y, to.y) - lift
  const h = (from.y + to.y) / 2 - top
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - 4 * h * p * (1 - p)
  }
}

/** Flight time for a jump, longer for longer jumps, within limits. */
export function jumpDurationMs(
  from: Point,
  to: Point,
  timing: { baseMs: number; msPerDip: number; maxMs: number }
): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  return Math.min(timing.maxMs, timing.baseMs + distance * timing.msPerDip)
}
