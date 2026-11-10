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
  climb: { chance: 0.1 },
  /**
   * requirement-v9.md FR-120: the quick buttons open when the pointer rests on the cat this long
   * without moving more than restMoveDip (a stroke keeps moving, so it never opens them).
   */
  actions: { restMs: 700, restMoveDip: 4 }
} as const

/** requirement-v9.md FR-127, FR-132: how the quick buttons look. */
export const ACTIONS_VIEW = {
  /** Emoji size as a share of the button diameter. */
  iconScale: 0.5,
  /** One picture per button state (the Focus button follows the timer, FR-129). */
  icons: {
    feed: '🍗',
    focusStart: '🍅',
    focusPause: '⏸️',
    focusResume: '▶️',
    focusStartBreak: '☕',
    settings: '⚙️',
    hide: '🙈'
  },
  /** Label: space between it and its button, and its widest size (main keeps room for it). */
  labelGap: 4,
  labelMaxWidth: 140,
  /** Labels stay this far inside the window and the screen. */
  labelInset: 2
} as const
