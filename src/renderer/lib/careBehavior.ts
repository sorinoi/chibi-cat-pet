/** Pure mood-driven behavior decisions (requirement-v2.md section 5). */
import { CARE, type CareConfig } from '../../shared/careConfig'
import type { Mood } from '../../shared/needs'

/** null when there is no adopted pet: v1 behavior. */
export type CareMood = Mood | null

/** What the wander timer does when it fires. */
export function idleAction(
  mood: CareMood,
  now: number,
  lastHungryReminderAt: number | null,
  c: CareConfig = CARE
): 'hungry' | 'wander' {
  if (mood !== 'hungry') return 'wander'
  const due =
    lastHungryReminderAt === null ||
    now < lastHungryReminderAt ||
    now - lastHungryReminderAt >= c.behavior.hungryReminderCooldownMs
  return due ? 'hungry' : 'wander'
}

/** Delay before the next wander, in ms. A sad pet wanders less often. */
export function wanderDelayMs(
  mood: CareMood,
  range: { min: number; max: number },
  random: number,
  c: CareConfig = CARE
): number {
  const seconds = range.min + random * (range.max - range.min)
  const factor = mood === 'sad' ? c.behavior.sadWanderDelayMultiplier : 1
  return seconds * 1000 * factor
}

/** Which reaction a click plays: a happy pet sometimes plays `happy` (FR-20). */
export function clickReaction(
  mood: CareMood,
  random: number,
  c: CareConfig = CARE
): 'click' | 'happy' {
  return mood === 'happy' && random < c.behavior.happyClickChance ? 'happy' : 'click'
}
