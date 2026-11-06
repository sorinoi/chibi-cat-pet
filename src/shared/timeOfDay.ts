/** Time-of-day rules (requirement-v4.md FR-58, FR-59). Pure; pass the time in. */
import { CARE, type CareConfig } from './careConfig'
import { localDate } from './focusTimer'

/** True when `hour` is in [from, to), with windows that cross midnight (e.g. 23 -> 5). */
export function inHourWindow(hour: number, from: number, to: number): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to
}

export function isMorning(now: number, c: CareConfig = CARE): boolean {
  return inHourWindow(new Date(now).getHours(), c.day.morningFromHour, c.day.morningToHour)
}

export function isNight(now: number, c: CareConfig = CARE): boolean {
  return inHourWindow(new Date(now).getHours(), c.day.nightFromHour, c.day.nightToHour)
}

/** FR-58: stretch on the first wake of a morning (`lastStretchDate` is YYYY-MM-DD or null). */
export function morningStretchDue(
  now: number,
  lastStretchDate: string | null,
  c: CareConfig = CARE
): boolean {
  return isMorning(now, c) && lastStretchDate !== localDate(now)
}

/** FR-59: idle seconds before the cat sleeps; shorter at night, never under a minute. */
export function sleepAfterSeconds(minutes: number, now: number, c: CareConfig = CARE): number {
  const seconds = minutes * 60
  return isNight(now, c) ? Math.max(60, Math.round(seconds * c.day.nightSleepFactor)) : seconds
}
