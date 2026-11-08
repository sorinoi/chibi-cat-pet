/**
 * requirement-v6.md NFR-35: a small fixed-window limit per API key, in memory (one server
 * process). Old windows are forgotten as keys come back, so it never grows without bound.
 */
export interface RateLimiter {
  /** True when this request is allowed. */
  allow(key: string): boolean
}

export function createRateLimiter(
  perWindow: number,
  windowMs = 60_000,
  now: () => number = () => Date.now()
): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>()
  return {
    allow(key) {
      const t = now()
      const w = windows.get(key)
      if (!w || t - w.start >= windowMs) {
        // Forget finished windows of other keys now and then.
        if (windows.size > 1000) {
          for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k)
        }
        windows.set(key, { start: t, count: 1 })
        return true
      }
      w.count += 1
      return w.count <= perWindow
    }
  }
}
