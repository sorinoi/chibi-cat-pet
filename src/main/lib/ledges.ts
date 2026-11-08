/**
 * requirement-v5.md FR-66, FR-67: which top edges of other apps' windows the cat can land
 * on while falling. Pure (no Electron or native imports, unit tested). All values in DIP.
 */
import { floorY, type Area, type Rect, type Size } from './placement'

/** One top-level window as the native window list reports it, front-most first. */
export interface DesktopWindow {
  id: number
  /** Visible frame (without the invisible resize borders), in DIP. */
  rect: Rect
  title: string
  className: string
  visible: boolean
  minimized: boolean
  maximized: boolean
  /** Hidden by DWM: another virtual desktop, a suspended store app (FR-67). */
  cloaked: boolean
  /** Belongs to this app (the pet, settings or adoption window). */
  own: boolean
  /** WS_EX_TOOLWINDOW. */
  toolWindow: boolean
  /** WS_EX_NOACTIVATE. */
  noActivate: boolean
  /** WS_EX_APPWINDOW: shown in the taskbar even when it is a tool window. */
  appWindow: boolean
  /** WS_EX_TRANSPARENT: mouse passes through (overlays). */
  clickThrough: boolean
}

/** Shell windows that are never perches or covers: the desktop and the taskbars. */
const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'])

const right = (r: Rect): number => r.x + r.width
const bottom = (r: Rect): number => r.y + r.height

/** Something you can see that hides what is behind it (FR-66 "covered"). */
export function isCover(w: DesktopWindow): boolean {
  return (
    w.visible &&
    !w.minimized &&
    !w.cloaked &&
    !w.own &&
    !w.clickThrough &&
    w.rect.width > 0 &&
    w.rect.height > 0 &&
    !SHELL_CLASSES.has(w.className)
  )
}

/** Covers a whole display: a fullscreen app (FR-67). */
function isFullscreen(rect: Rect, displays: readonly Rect[]): boolean {
  return displays.some(
    (d) => rect.x <= d.x && rect.y <= d.y && right(rect) >= right(d) && bottom(rect) >= bottom(d)
  )
}

/**
 * FR-67: a normal app window the cat may sit on. Like the Alt+Tab list: visible, not
 * minimized, maximized, fullscreen or cloaked, a titled app window (no tool or no-activate
 * windows unless they ask for a taskbar button), not ours, and wide enough.
 */
export function isPerch(w: DesktopWindow, displays: readonly Rect[], minWidth: number): boolean {
  if (!isCover(w) || w.maximized || w.title.trim() === '') return false
  if ((w.toolWindow || w.noActivate) && !w.appWindow) return false
  if (w.rect.width < minWidth) return false
  return !isFullscreen(w.rect, displays)
}

export interface LandingQuery {
  /** Pet window top-left now. */
  x: number
  y: number
  size: Size
  /** Pet window y -> feet line: feet = y + feetOffset. */
  feetOffset: number
  /** Half the width of the part under the cat that must be visible on an edge. */
  footHalfWidth: number
  /** Allowed positions on the display under the cat (its floor is area.maxY). */
  area: Area
  minPerchWidth: number
  /** Edges this close to the feet count as the one the cat stands on. */
  tolerance: number
}

export interface Landing {
  /** Pet window top y where the cat comes to rest. */
  y: number
  /** The window it lands on, or null for the floor. */
  perchId: number | null
  /** That window's frame when the landing was planned. */
  perchRect: Rect | null
}

/** True when a window in `front` hides the edge at `edgeY` between `left` and `right`. */
function edgeCovered(
  front: readonly DesktopWindow[],
  edgeY: number,
  spanLeft: number,
  spanRight: number
): boolean {
  return front.some(
    (c) =>
      isCover(c) &&
      c.rect.x < spanRight &&
      right(c.rect) > spanLeft &&
      c.rect.y <= edgeY &&
      bottom(c.rect) > edgeY
  )
}

/**
 * FR-66: where a cat falling straight down from (x, y) comes to rest: the first visible
 * top edge of a perch window below its feet and under its centre, or the floor. An edge
 * counts only if the cat fits above it inside the area, it is above the floor, and no
 * window in front covers the part of the edge under the cat. `windows` is front-most first.
 */
export function findLanding(
  q: LandingQuery,
  windows: readonly DesktopWindow[],
  displays: readonly Rect[]
): Landing {
  const feet = q.y + q.feetOffset
  const centerX = q.x + q.size.width / 2
  const spanLeft = centerX - q.footHalfWidth
  const spanRight = centerX + q.footHalfWidth
  let best: Landing = { y: floorY(q.area), perchId: null, perchRect: null }

  windows.forEach((w, index) => {
    if (!isPerch(w, displays, q.minPerchWidth)) return
    if (centerX < w.rect.x || centerX >= right(w.rect)) return
    const edge = w.rect.y
    if (edge < feet - q.tolerance) return // above the feet: the cat is past it
    const landingY = edge - q.feetOffset
    if (landingY >= best.y || landingY < q.area.minY) return
    if (!edgeCovered(windows.slice(0, index), edge, spanLeft, spanRight)) {
      best = { y: landingY, perchId: w.id, perchRect: w.rect }
    }
  })
  return best
}

/**
 * FR-68: the walkable stretch of a perch: the cat's centre stays `margin` inside the
 * window's edge, and the window stays inside the screen area.
 */
export function perchWalkArea(area: Area, perch: Rect, size: Size, margin: number): Area {
  const lo = perch.x + margin - size.width / 2
  const hi = right(perch) - margin - size.width / 2
  // A window narrower than both margins: the centre of the edge is the only spot.
  const [minX, maxX] = lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2]
  return {
    ...area,
    minX: Math.min(Math.max(minX, area.minX), area.maxX),
    maxX: Math.max(Math.min(maxX, area.maxX), area.minX)
  }
}

export interface PerchQuery {
  /** Pet window size and feet line, as in LandingQuery. */
  size: Size
  feetOffset: number
  footHalfWidth: number
  minPerchWidth: number
  /** FR-68 margin between the cat's centre and the window's side edges. */
  edgeMargin: number
  /** Pet window x minus the perch's x: where on the edge the cat sits. */
  offsetX: number
  /** Allowed positions on the display at a point (the perch may move to another display). */
  areaAt(point: { x: number; y: number }): Area
}

export type PerchFollow = { lost: true } | { lost: false; x: number; y: number }

/**
 * FR-69, FR-70: where a perched cat should be now that its window is `target` (null when
 * it is gone), or lost: the window was closed, minimized, maximized, cloaked, went
 * fullscreen or too narrow, its edge left the screen or the area, or a window in `front`
 * covers the part of the edge under the cat. Otherwise the cat keeps its place on the edge,
 * moved inward when the window got narrower.
 */
export function followPerch(
  q: PerchQuery,
  target: DesktopWindow | null,
  front: readonly DesktopWindow[],
  displays: readonly Rect[]
): PerchFollow {
  if (!target || !isPerch(target, displays, q.minPerchWidth)) return { lost: true }
  const edge = target.rect.y
  const area = q.areaAt({ x: target.rect.x + target.rect.width / 2, y: edge })
  const y = edge - q.feetOffset
  if (y < area.minY || y >= floorY(area)) return { lost: true }
  const walk = perchWalkArea(area, target.rect, q.size, q.edgeMargin)
  const x = Math.min(Math.max(target.rect.x + q.offsetX, walk.minX), walk.maxX)
  const centerX = x + q.size.width / 2
  if (centerX < target.rect.x || centerX >= right(target.rect)) return { lost: true }
  if (edgeCovered(front, edge, centerX - q.footHalfWidth, centerX + q.footHalfWidth)) {
    return { lost: true }
  }
  return { lost: false, x: Math.round(x), y: Math.round(y) }
}
