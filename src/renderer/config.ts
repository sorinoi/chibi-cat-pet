/** Renderer constants. Keep timings, sizes and colors here, not in components. */
export const RENDER = {
  /** Upper bound for devicePixelRatio when sizing the canvas. */
  maxPixelRatio: 2,
  /** Sheet alpha (0..255) above which a pixel counts as "on the cat" for clicks. */
  hitAlphaThreshold: 40
} as const

export const BEHAVIOR = {
  /**
   * requirement-v8.md FR-110, FR-117: per Activity level, the idle time before the cat wanders
   * (FR-06, seconds), the walk distance (DIP at pet size 1.0; main picks the direction toward
   * the room, FR-111) and how often a wander becomes a hop run (V8-M3). Calm is the v7 cat.
   */
  activity: {
    calm: {
      wanderDelaySeconds: { min: 20, max: 60 },
      walkDistance: { min: 80, max: 300 },
      hopChance: 0
    },
    normal: {
      wanderDelaySeconds: { min: 8, max: 25 },
      walkDistance: { min: 150, max: 500 },
      hopChance: 0.25
    },
    lively: {
      wanderDelaySeconds: { min: 4, max: 12 },
      walkDistance: { min: 200, max: 700 },
      hopChance: 1 / 3
    }
  },
  /**
   * requirement-v8.md FR-114, NFR-48: a hop run is 2-5 hops of 40-80 DIP each (pet size 1), and
   * never starts within minIntervalMs of the last one.
   */
  hop: { count: { min: 2, max: 5 }, distance: { min: 40, max: 80 }, minIntervalMs: 20_000 },
  /** DIP per second at pet size 1.0, roughly matched to the walk frames' stride. */
  walkSpeed: 45,
  /** Pointer travel (DIP) before a press becomes a drag instead of a click. */
  dragThreshold: 4,
  /**
   * requirement-v5.md FR-73, FR-75, NFR-30: a wander becomes a jump attempt this often, and
   * not again for cooldownMs after a jump (at most a few per hour).
   */
  jump: { chance: 0.2, cooldownMs: 10 * 60 * 1000 },
  /** FR-76, NFR-30: otherwise a wander becomes a climb attempt this often (same cooldown). */
  climb: { chance: 0.1 }
} as const
