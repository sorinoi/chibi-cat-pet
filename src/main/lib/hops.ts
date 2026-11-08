/**
 * requirement-v8.md FR-114, FR-115: planning a hop run. Pure (no Electron imports), unit
 * tested. All distances in DIP (already scaled to the pet size by the caller).
 */
import type { Area } from './placement'

export interface HopRunQuery {
  /** Pet window x now. */
  x: number
  /** Where the cat may stand: the floor area, or the perch's walk area. */
  area: Area
  direction: 1 | -1
  /** Hops wanted, and the sideways distance of each. */
  count: number
  distance: number
  /** A hop shorter than this is not worth it: the run ends there. */
  minHop: number
}

/** The x the window lands on after each hop, in order; empty when there is no room. */
export function planHops(q: HopRunQuery): number[] {
  const xs: number[] = []
  let x = q.x
  for (let i = 0; i < q.count; i++) {
    const next = Math.min(q.area.maxX, Math.max(q.area.minX, x + q.direction * q.distance))
    if (Math.abs(next - x) < q.minHop) break
    xs.push(Math.round(next))
    x = next
  }
  return xs
}

export interface HopTiming {
  /** Still on the ground before take-off (crouch). */
  groundMs: number
  /** In the air. */
  airMs: number
  /** Still on the ground after landing. */
  landMs: number
  totalMs: number
}

/**
 * Splits one hop (one play of the hop clip) into ground, air and landing time from the clip's
 * frame durations: frames before `airFrom` are the crouch, `airFrom`..`airTo` are in the air.
 */
export function hopTiming(frameMs: readonly number[], airFrom: number, airTo: number): HopTiming {
  const sum = (from: number, to: number): number =>
    frameMs.slice(from, to).reduce((a, b) => a + b, 0)
  const groundMs = sum(0, airFrom)
  const airMs = sum(airFrom, airTo + 1)
  const landMs = sum(airTo + 1, frameMs.length)
  return { groundMs, airMs, landMs, totalMs: groundMs + airMs + landMs }
}

/** Where a hop is `elapsedMs` after it began: progress 0..1 across the air time (0 before). */
export function hopProgress(elapsedMs: number, timing: HopTiming): number {
  if (elapsedMs <= timing.groundMs) return 0
  return Math.min(1, (elapsedMs - timing.groundMs) / Math.max(1, timing.airMs))
}
