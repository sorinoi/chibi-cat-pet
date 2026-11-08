/** Renderer constants. Keep timings, sizes and colors here, not in components. */
export const RENDER = {
  /** Upper bound for devicePixelRatio when sizing the canvas. */
  maxPixelRatio: 2,
  /** Sheet alpha (0..255) above which a pixel counts as "on the cat" for clicks. */
  hitAlphaThreshold: 40
} as const

export const BEHAVIOR = {
  /** Idle time before the cat wanders off on its own (FR-06), seconds. */
  wanderDelaySeconds: { min: 20, max: 60 },
  /** Walk distance in DIP at pet size 1.0; the direction is random. */
  walkDistance: { min: 80, max: 300 },
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
