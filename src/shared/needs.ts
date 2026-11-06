/**
 * Pure pet-care math (requirement-v2.md sections 4-6, NFR-12). No clocks, no I/O:
 * callers pass elapsed times and timestamps, so every rule is unit tested.
 */
import { CARE, type CareConfig } from './careConfig'

export interface Needs {
  /** Fullness, 0..100 (100 = just ate). */
  hunger: number
  /** 0..100. */
  happiness: number
}

/** How the time between two updates was spent. */
export type DecayMode = 'awake' | 'asleep' | 'offline'

export type Mood = 'hungry' | 'sad' | 'happy' | 'content'

const HOUR_MS = 3_600_000

const clamp = (n: number): number => Math.min(100, Math.max(0, n))

function modeFactor(mode: DecayMode, c: CareConfig): number {
  if (mode === 'asleep') return c.sleepRate
  if (mode === 'offline') return c.offlineRate
  return 1
}

/** Linear decay that stops at `floor`, but never raises a value already below it. */
function decay(value: number, perMs: number, ms: number, floor: number): number {
  if (value <= floor) return value
  return Math.max(floor, value - perMs * ms)
}

/** Time until a linearly decaying value reaches `target` (Infinity if it never does). */
function timeToReach(value: number, perMs: number, target: number, floor: number): number {
  if (value <= target) return 0
  if (floor >= target || perMs <= 0) return Infinity
  return (value - target) / perMs
}

/**
 * Needs after `elapsedMs` spent in `mode`. Happiness drops faster for exactly the part
 * of the time the pet was hungry, so the result does not depend on how often it is called.
 * Negative elapsed time (clock moved backwards) changes nothing.
 */
export function advanceNeeds(
  needs: Needs,
  elapsedMs: number,
  mode: DecayMode,
  c: CareConfig = CARE
): Needs {
  if (!(elapsedMs > 0)) return { ...needs }
  const f = modeFactor(mode, c)
  const floor = mode === 'offline' ? c.offlineFloor : 0
  const hungerPerMs = (100 / (c.hungerHoursToEmpty * HOUR_MS)) * f
  const happyPerMs = (100 / (c.happinessHoursToEmpty * HOUR_MS)) * f

  const hunger = decay(needs.hunger, hungerPerMs, elapsedMs, floor)

  // Hungry means hunger strictly below the threshold; find when that starts.
  const threshold = c.moods.hungryBelow
  let hungryFrom: number
  if (needs.hunger < threshold) hungryFrom = 0
  else {
    const reach = timeToReach(needs.hunger, hungerPerMs, threshold, floor)
    hungryFrom = Number.isFinite(reach) && hunger < threshold ? reach : Infinity
  }
  const normalMs = Math.min(elapsedMs, hungryFrom)
  const hungryMs = elapsedMs - normalMs

  let happiness = decay(needs.happiness, happyPerMs, normalMs, floor)
  happiness = decay(happiness, happyPerMs * c.hungryHappinessMultiplier, hungryMs, floor)

  return { hunger: clamp(hunger), happiness: clamp(happiness) }
}

/**
 * Picks the decay mode for the time since the last update while the app runs. A gap much
 * longer than the tick interval means the PC slept or the app froze: count it as offline.
 */
export function runningMode(
  elapsedMs: number,
  petAsleep: boolean,
  c: CareConfig = CARE
): DecayMode {
  if (elapsedMs > c.maxTickGapMs) return 'offline'
  return petAsleep ? 'asleep' : 'awake'
}

/** Mood from needs, by priority: hungry, sad, happy, content (section 5). */
export function moodOf(needs: Needs, c: CareConfig = CARE): Mood {
  if (needs.hunger < c.moods.hungryBelow) return 'hungry'
  if (needs.happiness < c.moods.sadBelow) return 'sad'
  if (needs.hunger >= c.moods.happyFrom && needs.happiness >= c.moods.happyFrom) return 'happy'
  return 'content'
}

export interface FeedResult {
  needs: Needs
  /** True when the pet was too full to eat (FR-17); needs are unchanged then. */
  refused: boolean
}

export function feed(needs: Needs, c: CareConfig = CARE): FeedResult {
  if (needs.hunger >= c.fullThreshold) return { needs: { ...needs }, refused: true }
  return {
    needs: {
      hunger: clamp(needs.hunger + c.feedHunger),
      happiness: clamp(needs.happiness + c.feedHappiness)
    },
    refused: false
  }
}

export interface BonusResult {
  needs: Needs
  /** True when the bonus counted; false inside the cooldown (the animation still plays). */
  counted: boolean
}

/** Happiness bonus with a cooldown. `lastAt` is the time of the last counted bonus. */
function bonus(
  needs: Needs,
  amount: number,
  cooldownMs: number,
  now: number,
  lastAt: number | null
): BonusResult {
  if (lastAt !== null && now >= lastAt && now - lastAt < cooldownMs) {
    return { needs: { ...needs }, counted: false }
  }
  return { needs: { ...needs, happiness: clamp(needs.happiness + amount) }, counted: true }
}

/** FR-18/FR-19. */
export function pet(
  needs: Needs,
  now: number,
  lastAt: number | null,
  c: CareConfig = CARE
): BonusResult {
  return bonus(needs, c.petHappiness, c.petCooldownMs, now, lastAt)
}

/** FR-20. */
export function click(
  needs: Needs,
  now: number,
  lastAt: number | null,
  c: CareConfig = CARE
): BonusResult {
  return bonus(needs, c.clickHappiness, c.clickCooldownMs, now, lastAt)
}
