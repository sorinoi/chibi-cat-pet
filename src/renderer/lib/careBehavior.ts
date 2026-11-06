/** Pure mood-driven behavior decisions (requirement-v2.md section 5). */
import { CARE, type CareConfig } from '../../shared/careConfig'
import type { Mood } from '../../shared/needs'

/** null when there is no adopted pet: v1 behavior. */
export type CareMood = Mood | null

/** What the model can play and the time of day, for the v4 idle choices (FR-55, FR-59). */
export interface IdleExtras {
  /** The model has a `sad` clip (without it the sad mood only wanders less). */
  canSad?: boolean
  /** It is night and the model has a `yawn` clip. */
  nightYawn?: boolean
  /** 0..1, for the yawn chance. */
  random?: number
}

export type IdleAction = 'hungry' | 'sad' | 'yawn' | 'wander'

/**
 * What the wander timer does when it fires: a mood reminder (hungry, or sad when the art
 * exists) at most every 10 minutes, a yawn now and then at night, otherwise a wander.
 * `lastReminderAt` is the last hungry or sad reminder.
 */
export function idleAction(
  mood: CareMood,
  now: number,
  lastReminderAt: number | null,
  c: CareConfig = CARE,
  extras: IdleExtras = {}
): IdleAction {
  const due = (cooldownMs: number): boolean =>
    lastReminderAt === null || now < lastReminderAt || now - lastReminderAt >= cooldownMs
  if (mood === 'hungry' && due(c.behavior.hungryReminderCooldownMs)) return 'hungry'
  if (mood === 'sad' && extras.canSad && due(c.behavior.sadReminderCooldownMs)) return 'sad'
  if (extras.nightYawn && (extras.random ?? 1) < c.day.nightYawnChance) return 'yawn'
  return 'wander'
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
