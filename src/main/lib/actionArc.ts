/**
 * requirement-v9.md FR-124, FR-125: where the quick buttons go around the cat. Pure math in
 * screen DIP, so it can be tested without windows.
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ArcInput {
  /** Top centre of the cat's art (screen DIP). */
  head: Point
  /** Bottom centre of the cat's art, at the feet (screen DIP). */
  feet: Point
  /** Work area of the display the cat is on (screen DIP). */
  area: Rect
  /** How many buttons (left to right). */
  count: number
  /** Button diameter (DIP). */
  buttonSize: number
  /** Distance from the arc centre to each button centre (DIP). */
  radius: number
  /** Angle between the first and the last button (degrees). */
  spreadDeg: number
  /**
   * The arc centre sits this far (a fraction of the radius) inside the cat from the head (or
   * the feet when flipped), so the end buttons sit beside it and the middle ones over it.
   */
  centreInset: number
  /** Space kept between every button and the edge of the work area (DIP). */
  edgeMargin: number
  /** Largest turn toward the middle of the display before the arc shifts instead (degrees). */
  maxTurnDeg: number
  turnStepDeg: number
  /** Room around the buttons inside the window (hover growth, bobbing) (DIP). */
  windowPad: number
}

export interface ArcLayout {
  side: 'above' | 'below'
  /** Degrees the arc was turned toward the middle (positive = toward the right). */
  turnDeg: number
  /** The buttons window (screen DIP, whole numbers). */
  window: Rect
  /** Button centres relative to the window (DIP), left to right. */
  buttons: Point[]
}

const toRad = (deg: number): number => (deg * Math.PI) / 180

/** Button angles from "straight out" (0), left to right, before any turn. */
function angles(count: number, spreadDeg: number): number[] {
  if (count <= 1) return [0]
  const step = spreadDeg / (count - 1)
  return Array.from({ length: count }, (_, i) => -spreadDeg / 2 + i * step)
}

function centres(input: ArcInput, side: ArcLayout['side'], turnDeg: number): Point[] {
  const { head, feet, radius, centreInset, count, spreadDeg } = input
  // Above: the arc opens upward around the head. Below: it opens downward under the feet.
  const dir = side === 'above' ? -1 : 1
  const origin =
    side === 'above'
      ? { x: head.x, y: head.y + radius * centreInset }
      : { x: feet.x, y: feet.y - radius * centreInset }
  // A positive turn moves the buttons toward the right on either side.
  return angles(count, spreadDeg).map((a) => {
    const t = toRad(a + turnDeg)
    return { x: origin.x + radius * Math.sin(t), y: origin.y + dir * radius * Math.cos(t) }
  })
}

/** How far the buttons stick out of the usable area on each side (0 = fits). */
function overflow(
  points: Point[],
  input: ArcInput
): { top: number; bottom: number; left: number; right: number } {
  const half = input.buttonSize / 2 + input.edgeMargin
  const { area } = input
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    left: Math.max(0, area.x - (Math.min(...xs) - half)),
    right: Math.max(0, Math.max(...xs) + half - (area.x + area.width)),
    top: Math.max(0, area.y - (Math.min(...ys) - half)),
    bottom: Math.max(0, Math.max(...ys) + half - (area.y + area.height))
  }
}

const verticalFits = (o: ReturnType<typeof overflow>): boolean => o.top === 0 && o.bottom === 0
const horizontalFits = (o: ReturnType<typeof overflow>): boolean => o.left === 0 && o.right === 0

/**
 * FR-124: the arc over the head. FR-125: if it does not fit above inside the work area it opens
 * below the feet; if it crosses a side edge it turns toward the middle of the display, and if
 * that is not enough it shifts. Every button ends up fully inside the work area.
 */
export function layoutActionArc(input: ArcInput): ArcLayout {
  const above = overflow(centres(input, 'above', 0), input)
  const below = overflow(centres(input, 'below', 0), input)
  const side: ArcLayout['side'] =
    verticalFits(above) ||
    (!verticalFits(below) && above.top + above.bottom <= below.top + below.bottom)
      ? 'above'
      : 'below'

  // Turn toward the middle: buttons sticking out on the left turn toward the right.
  let turnDeg = 0
  let points = centres(input, side, 0)
  const first = overflow(points, input)
  if (!horizontalFits(first)) {
    const sign = first.left > first.right ? 1 : -1
    for (let turn = input.turnStepDeg; turn <= input.maxTurnDeg; turn += input.turnStepDeg) {
      const turned = centres(input, side, sign * turn)
      const o = overflow(turned, input)
      turnDeg = sign * turn
      points = turned
      if (horizontalFits(o) && verticalFits(o)) break
    }
  }

  // Whatever still sticks out: shift the whole arc back inside.
  const o = overflow(points, input)
  const dx = o.left - o.right
  const dy = o.top - o.bottom
  points = points.map((p) => ({ x: p.x + dx, y: p.y + dy }))

  const reach = input.buttonSize / 2 + input.windowPad
  const left = Math.floor(Math.min(...points.map((p) => p.x)) - reach)
  const top = Math.floor(Math.min(...points.map((p) => p.y)) - reach)
  const right = Math.ceil(Math.max(...points.map((p) => p.x)) + reach)
  const bottom = Math.ceil(Math.max(...points.map((p) => p.y)) + reach)
  return {
    side,
    turnDeg,
    window: { x: left, y: top, width: right - left, height: bottom - top },
    buttons: points.map((p) => ({ x: p.x - left, y: p.y - top }))
  }
}
