/** Pure window placement math (no Electron imports, unit tested). All values in DIP. */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Overflow {
  x: number
  top: number
  bottom: number
}

/** Allowed range for the window's top-left corner. */
export interface Area {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function allowedArea(workArea: Rect, size: Size, overflow: Overflow): Area {
  const minX = workArea.x - overflow.x
  const minY = workArea.y - overflow.top
  return {
    minX,
    minY,
    // If the window is wider than the area, pin it to the left/top edge.
    maxX: Math.max(minX, workArea.x + workArea.width - size.width + overflow.x),
    maxY: Math.max(minY, workArea.y + workArea.height - size.height + overflow.bottom)
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export function clampPosition(x: number, y: number, area: Area): { x: number; y: number } {
  return { x: clamp(x, area.minX, area.maxX), y: clamp(y, area.minY, area.maxY) }
}

/**
 * DIP values that are multiples of this are whole device pixels at 125, 150, 175 and 200 %
 * scaling. A new window with a fractional pixel size or origin came out a few pixels too
 * big on Windows, so window sizes and the restored start position snap to this grid.
 */
export const WINDOW_GRID = 4

const roundUpToGrid = (n: number): number => Math.ceil(n / WINDOW_GRID) * WINDOW_GRID
const roundToGrid = (n: number): number => Math.round(n / WINDOW_GRID) * WINDOW_GRID

/** Window size for a pet scale, rounded up to the window grid. */
export function scaledSize(base: Size, scale: number): Size {
  return { width: roundUpToGrid(base.width * scale), height: roundUpToGrid(base.height * scale) }
}

/** Start position snapped to the window grid, then kept inside the area. */
export function snapToGrid(x: number, y: number, area: Area): { x: number; y: number } {
  return clampPosition(roundToGrid(x), roundToGrid(y), area)
}

/** Overflow grows with the window, since the transparent margins grow too. */
export function scaledOverflow(base: Overflow, scale: number): Overflow {
  return {
    x: Math.round(base.x * scale),
    top: Math.round(base.top * scale),
    bottom: Math.round(base.bottom * scale)
  }
}

/**
 * Resizes `bounds` to `size` while keeping the bottom center fixed, so the cat
 * grows or shrinks where its feet are instead of jumping.
 */
export function resizeKeepingFeet(bounds: Rect, size: Size): Rect {
  return {
    x: Math.round(bounds.x + bounds.width / 2 - size.width / 2),
    y: Math.round(bounds.y + bounds.height - size.height),
    width: size.width,
    height: size.height
  }
}

/**
 * Plans a horizontal walk from `x`. Tries the requested direction first, then the
 * opposite one. Returns the clamped signed distance, or 0 when neither has room.
 */
export function planWalk(x: number, dx: number, area: Area, minDistance: number): number {
  for (const candidate of [dx, -dx]) {
    const planned = clamp(x + candidate, area.minX, area.maxX) - x
    if (Math.abs(planned) >= minDistance) return planned
  }
  return 0
}
