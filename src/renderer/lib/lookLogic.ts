/** Where the cat should look (requirement-v4.md FR-56). Pure, unit tested. */
import { CARE, type CareConfig } from '../../shared/careConfig'

export type LookSide = 'left' | 'right'

export interface LookInput {
  /** Cursor relative to the pet window, in DIP (may be outside it). */
  x: number
  y: number
  /** Pet window size in DIP. */
  width: number
  height: number
  /** The cursor is over the cat itself (then it is a click or stroke, not a look). */
  overPet: boolean
}

/** The side to look at, or null when the cursor is too far away or over the cat. */
export function lookSide(input: LookInput, c: CareConfig = CARE): LookSide | null {
  const { x, y, width, height, overPet } = input
  if (overPet) return null
  const dx = x < 0 ? -x : x > width ? x - width : 0
  const dy = y < 0 ? -y : y > height ? y - height : 0
  if (Math.hypot(dx, dy) > c.look.radius) return null
  return x < width / 2 ? 'left' : 'right'
}
