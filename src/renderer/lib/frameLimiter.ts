export interface FrameLimiter {
  /**
   * Call once per animation frame with the frame timestamp (ms).
   * Returns the seconds elapsed since the last rendered frame, or null to skip this frame.
   */
  tick(nowMs: number): number | null
  reset(): void
}

/** Caps rendering at `maxFps` while keeping a steady cadence (NFR-02). */
export function createFrameLimiter(maxFps: number, maxDeltaSeconds = 0.1): FrameLimiter {
  const interval = 1000 / maxFps
  // Small tolerance so a 60 Hz display reliably yields every second frame.
  const tolerance = interval * 0.1
  let last: number | null = null

  return {
    tick(nowMs) {
      if (last === null) {
        last = nowMs
        return 0
      }
      const elapsed = nowMs - last
      if (elapsed + tolerance < interval) return null
      // Keep the cadence aligned instead of drifting with late frames.
      last =
        elapsed > interval * 2
          ? nowMs
          : last + interval * Math.floor((elapsed + tolerance) / interval)
      return Math.min(elapsed / 1000, maxDeltaSeconds)
    },
    reset() {
      last = null
    }
  }
}
