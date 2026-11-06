import type { SpriteClip } from '../../shared/modelConfig'

export interface FrameState {
  /** Frame index within the clip (also the sheet column). */
  frame: number
  /** True once a non-looping clip has shown its last frame for its full duration. */
  finished: boolean
  /** ms until the frame changes; null when it never will (finished). */
  nextChangeMs: number | null
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

/** Finds the frame covering `t` within `frameMs[from..]`, where t is relative to `from`. */
function locate(
  frameMs: readonly number[],
  from: number,
  t: number
): { frame: number; untilNext: number } {
  let start = 0
  for (let i = from; i < frameMs.length; i++) {
    const end = start + frameMs[i]
    if (t < end) return { frame: i, untilNext: end - t }
    start = end
  }
  return { frame: frameMs.length - 1, untilNext: 0 }
}

/**
 * Which frame a clip shows `elapsedMs` after it started. Looping clips play every frame
 * once, then repeat from `loopFrom` (so an intro like "lie down" plays only once).
 */
export function frameAt(clip: SpriteClip, elapsedMs: number): FrameState {
  const t = Math.max(0, elapsedMs)
  const firstPass = sum(clip.frameMs)
  if (t < firstPass) {
    const { frame, untilNext } = locate(clip.frameMs, 0, t)
    return { frame, finished: false, nextChangeMs: untilNext }
  }
  if (!clip.loop) return { frame: clip.frames - 1, finished: true, nextChangeMs: null }

  const loopLength = sum(clip.frameMs.slice(clip.loopFrom))
  const { frame, untilNext } = locate(clip.frameMs, clip.loopFrom, (t - firstPass) % loopLength)
  return { frame, finished: false, nextChangeMs: untilNext }
}
