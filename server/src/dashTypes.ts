/**
 * requirement-v6.md FR-96, FR-97: what the dashboard API returns. Shared by the server and the
 * dashboard pages (server/web). Times are UTC epoch ms; dates are "YYYY-MM-DD" in the server's
 * time zone.
 */

export interface Me {
  name: string
  /** IANA zone the dates are counted in (FR-98). */
  timeZone: string
}

export interface PetSummary {
  id: string
  name: string
  adoptedAt: number
  replacedAt: number | null
  lastEventAt: number
}

export interface NeedsPoint {
  at: number
  hunger: number
  happiness: number
}

export interface CareDay {
  date: string
  feed: number
  pet: number
  treat: number
}

export interface CountAt {
  /** A day, or the Monday that starts a week. */
  date: string
  count: number
}

export interface Overview {
  pet: PetSummary
  days: number
  /** Start of the first day and end of today (UTC ms): the time axis. */
  from: number
  to: number
  /** The day keys of the range, oldest first. */
  dayKeys: string[]
  /** The newest event's needs and mood; null when the pet has no events in range. */
  last: { at: number; hunger: number; happiness: number; mood: string } | null
  needs: NeedsPoint[]
  care: CareDay[]
  focusDays: CountAt[]
  focusWeeks: CountAt[]
  /** Days in a row with at least one completed focus, up to today (or yesterday). */
  streak: number
  totals: { feed: number; pet: number; treat: number; focus: number }
}

export interface EventRow {
  id: string
  type: string
  at: number
  tz: number
  petId: string
  petName: string
  hunger: number
  happiness: number
  mood: string
  data: Record<string, unknown>
}

export interface EventPage {
  total: number
  page: number
  size: number
  rows: EventRow[]
}

export const OVERVIEW_DAYS = [7, 30] as const
export const EVENT_PAGE_SIZE = 50
