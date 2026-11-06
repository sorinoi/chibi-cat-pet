/** When to show the optional hungry notification (requirement-v4.md FR-46/47). Pure. */
import { CARE, type CareConfig } from './careConfig'

export interface HungerNoticeInput {
  /** The setting (off by default). */
  enabled: boolean
  /** null when there is no cat. */
  hunger: number | null
  /** Epoch ms of the last hungry notification in this run, or null. */
  lastShownAt: number | null
  /** The user is away (FR-07) or a fullscreen app is in front (FR-16): wait for them. */
  userBusy: boolean
  now: number
}

export function shouldShowHungerNotice(input: HungerNoticeInput, c: CareConfig = CARE): boolean {
  const { enabled, hunger, lastShownAt, userBusy, now } = input
  if (!enabled || hunger === null || userBusy) return false
  if (hunger >= c.hungryNotice.below) return false
  if (lastShownAt === null || now < lastShownAt) return true
  return now - lastShownAt >= c.hungryNotice.everyMs
}
