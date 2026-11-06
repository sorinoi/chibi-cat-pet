import { CARE, type CareConfig } from '../../shared/careConfig'

export interface StrokeSample {
  /** Cursor x in DIP (screen or client, as long as it is consistent). */
  x: number
  /** ms timestamp. */
  t: number
  /** Is the cursor over the cat right now? */
  overPet: boolean
  /** Any mouse button held? Strokes are moves without pressing (pressing is click/drag). */
  pressed: boolean
}

export interface StrokeDetector {
  /** Feed every mouse move. Returns true when a stroke is recognized (FR-18). */
  push(sample: StrokeSample): boolean
  reset(): void
}

/**
 * Recognizes petting: the cursor moves back and forth over the cat, with at least
 * `directionChanges` reversals inside `windowMs`. Tiny moves are ignored as jitter, and
 * leaving the cat or pressing a button starts over, so normal mouse moves across the
 * desktop do not trigger it.
 */
export function createStrokeDetector(c: CareConfig['stroke'] = CARE.stroke): StrokeDetector {
  let anchorX: number | null = null
  let direction: -1 | 0 | 1 = 0
  let reversals: number[] = []

  function reset(): void {
    anchorX = null
    direction = 0
    reversals = []
  }

  return {
    push({ x, t, overPet, pressed }) {
      if (!overPet || pressed) {
        reset()
        return false
      }
      if (anchorX === null) {
        anchorX = x
        return false
      }
      const dx = x - anchorX
      if (Math.abs(dx) < c.minSegment) return false
      const next = dx > 0 ? 1 : -1
      if (direction !== 0 && next !== direction) reversals.push(t)
      direction = next
      anchorX = x
      reversals = reversals.filter((r) => t - r <= c.windowMs)
      if (reversals.length >= c.directionChanges) {
        reset()
        return true
      }
      return false
    },
    reset
  }
}
