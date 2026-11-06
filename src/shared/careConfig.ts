/**
 * All pet-care tuning values in one place (requirement-v2.md sections 4-6, NFR-14).
 * Proposed defaults; tune after play-testing.
 */
export const CARE = {
  /** Running time for a need to go from 100 to 0. */
  hungerHoursToEmpty: 10,
  happinessHoursToEmpty: 12,
  /** Happiness drops this much faster while the pet is hungry. */
  hungryHappinessMultiplier: 2,
  /** Rate while the app is closed or the PC is off / asleep. */
  offlineRate: 0.25,
  /** Offline decay never takes a need below this. */
  offlineFloor: 30,
  /** Rate while the pet sleeps because the user is away. */
  sleepRate: 0.5,

  feedHunger: 40,
  feedHappiness: 5,
  /** At or above this hunger the pet refuses food. */
  fullThreshold: 95,
  petHappiness: 15,
  petCooldownMs: 30_000,
  clickHappiness: 2,
  clickCooldownMs: 10_000,

  /** Needs of a newly adopted pet. */
  startNeeds: { hunger: 80, happiness: 80 },

  moods: {
    /** Below this hunger: hungry. */
    hungryBelow: 30,
    /** Below this happiness: sad. */
    sadBelow: 30,
    /** Both at or above this: happy. */
    happyFrom: 80
  },

  /** How often needs are recomputed and saved while the app runs. */
  tickIntervalMs: 60_000,
  /**
   * A gap between ticks longer than this means the PC was asleep or the app was frozen;
   * the whole gap then counts at the offline rate.
   */
  maxTickGapMs: 5 * 60_000,
  /** Batch rapid care actions into one write. */
  saveDebounceMs: 1_000,

  nameMaxLength: 20
} as const

export type CareConfig = typeof CARE
