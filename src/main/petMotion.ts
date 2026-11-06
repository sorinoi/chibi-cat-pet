import { screen, type BrowserWindow, type Point, type Rectangle } from 'electron'
import { MOTION, PET_WINDOW } from './config'
import {
  allowedArea,
  clampPosition,
  planWalk,
  resizeKeepingFeet,
  scaledOverflow,
  scaledSize,
  type Area,
  type Size
} from './lib/placement'
import type { WalkEnded, WalkRequest } from '../shared/ipc'
import type { Position } from '../shared/settings'

export interface PetMotion {
  startDrag(): void
  endDrag(): void
  /** Returns the planned signed distance (0 = no room or currently dragging). */
  startWalk(request: WalkRequest): number
  stopWalk(): void
  /** FR-11 pet size: resizes the window around the cat's feet. */
  setScale(scale: number): void
  dispose(): void
}

export interface PetMotionEvents {
  onWalkEnded(event: WalkEnded): void
  /** The window came to rest at a new position (after a drag, walk or resize). */
  onSettled(position: Position): void
}

export function petWindowSize(scale: number): Size {
  return scaledSize(PET_WINDOW, scale)
}

/** Top-left for the window: `preferred` if given, else lower right; always kept on screen. */
export function initialPosition(scale: number, preferred: Position | null): Position {
  const size = petWindowSize(scale)
  const overflow = scaledOverflow(MOTION.overflow, scale)
  if (preferred) {
    // getDisplayMatching picks the nearest display, so a position on a monitor that
    // was unplugged lands on a connected one.
    const { workArea } = screen.getDisplayMatching({ ...preferred, ...size })
    return clampPosition(preferred.x, preferred.y, allowedArea(workArea, size, overflow))
  }
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width - size.width - PET_WINDOW.edgeMargin),
    y: Math.round(workArea.y + workArea.height - size.height - PET_WINDOW.edgeMargin)
  }
}

/**
 * Moves the pet window: follows the cursor while dragging (FR-04) and walks it
 * horizontally (FR-06). Positions are clamped to the work area of the display
 * under the cursor (drag) or under the window (walk), so multi-monitor works.
 */
export function createPetMotion(
  win: BrowserWindow,
  initialScale: number,
  events: PetMotionEvents
): PetMotion {
  let scale = initialScale
  let dragTimer: NodeJS.Timeout | null = null
  let dragOffset: Point = { x: 0, y: 0 }
  let walkTimer: NodeJS.Timeout | null = null

  function areaAt(point: Point): Area {
    const { workArea } = screen.getDisplayNearestPoint(point)
    return allowedArea(workArea, petWindowSize(scale), scaledOverflow(MOTION.overflow, scale))
  }

  function centerOf(b: Rectangle): Point {
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
  }

  function moveTo(x: number, y: number): void {
    if (win.isDestroyed()) return
    // setBounds with a fixed size: setPosition alone can resize the window when it
    // crosses monitors with different DPI scaling.
    win.setBounds({ x: Math.round(x), y: Math.round(y), ...petWindowSize(scale) })
  }

  function settled(): void {
    if (win.isDestroyed()) return
    const { x, y } = win.getBounds()
    events.onSettled({ x, y })
  }

  function finishWalk(completed: boolean): void {
    if (!walkTimer) return
    clearInterval(walkTimer)
    walkTimer = null
    settled()
    events.onWalkEnded({ completed })
  }

  function endDrag(): void {
    if (!dragTimer) return
    clearInterval(dragTimer)
    dragTimer = null
    settled()
  }

  return {
    startDrag() {
      finishWalk(false)
      endDrag()
      const cursor = screen.getCursorScreenPoint()
      const bounds = win.getBounds()
      dragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
      dragTimer = setInterval(() => {
        const c = screen.getCursorScreenPoint()
        const target = clampPosition(c.x - dragOffset.x, c.y - dragOffset.y, areaAt(c))
        const now = win.getBounds()
        if (target.x !== now.x || target.y !== now.y) moveTo(target.x, target.y)
      }, MOTION.dragIntervalMs)
    },

    endDrag,

    startWalk({ dx, speed }) {
      if (dragTimer || !Number.isFinite(dx) || !Number.isFinite(speed) || speed <= 0) return 0
      finishWalk(false)
      const bounds = win.getBounds()
      // Walk distance and speed are in "cat units", so they scale with the pet.
      const planned = planWalk(
        bounds.x,
        dx * scale,
        areaAt(centerOf(bounds)),
        MOTION.minWalkDistance
      )
      if (planned === 0) return 0

      const startX = bounds.x
      const y = bounds.y
      const distance = Math.abs(planned)
      const direction = Math.sign(planned)
      const pxPerMs = (Math.min(speed, MOTION.maxWalkSpeed) * scale) / 1000
      const startedAt = Date.now()

      walkTimer = setInterval(() => {
        const travelled = Math.min(distance, (Date.now() - startedAt) * pxPerMs)
        moveTo(startX + direction * travelled, y)
        if (travelled >= distance) finishWalk(true)
      }, MOTION.walkIntervalMs)
      return planned
    },

    stopWalk() {
      finishWalk(false)
    },

    setScale(next) {
      if (next === scale || win.isDestroyed()) return
      finishWalk(false)
      const resized = resizeKeepingFeet(win.getBounds(), petWindowSize(next))
      scale = next
      const pos = clampPosition(resized.x, resized.y, areaAt(centerOf(resized)))
      moveTo(pos.x, pos.y)
      settled()
    },

    dispose() {
      if (dragTimer) clearInterval(dragTimer)
      dragTimer = null
      if (walkTimer) clearInterval(walkTimer)
      walkTimer = null
    }
  }
}
