/**
 * requirement-v6.md FR-96: the overview numbers, from raw event rows. Pure (no database), unit
 * tested. Days are counted in the server's time zone.
 */
import type { CareDay, CountAt, NeedsPoint, Overview, PetSummary } from './dashTypes.ts'

const DAY_MS = 24 * 60 * 60_000
/** Most points drawn on the needs line. */
export const MAX_NEEDS_POINTS = 240
export const FOCUS_WEEKS = 8

export interface StatRow {
  type: string
  at: number
  hunger: number
  happiness: number
  mood: string
  data: Record<string, unknown>
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** "YYYY-MM-DD" of `ms` in `timeZone`. */
export function dayKey(ms: number, timeZone: string): string {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    formatters.set(timeZone, f)
  }
  return f.format(ms)
}

/** Minutes `timeZone` is ahead of UTC at `ms`. */
export function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(ms)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
  if (!m) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return m[1] === '-' ? -minutes : minutes
}

/** UTC ms of local midnight that starts `day` ("YYYY-MM-DD") in `timeZone`. */
export function dayStart(day: string, timeZone: string): number {
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number]
  const guess = Date.UTC(y, mo - 1, d)
  return guess - zoneOffsetMinutes(guess, timeZone) * 60_000
}

/** The last `n` day keys, oldest first, ending today. */
export function lastDays(now: number, timeZone: string, n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS, timeZone)
    if (days.at(-1) !== key) days.push(key)
  }
  return days
}

/** The Monday that starts the week of `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

const isCompletedFocus = (r: StatRow): boolean =>
  r.type === 'focus.phaseEnded' && r.data['phase'] === 'focus' && r.data['completed'] === true

/** Days in a row with a completed focus, ending today, or yesterday when today has none yet. */
export function focusStreak(focusDays: ReadonlySet<string>, now: number, timeZone: string): number {
  let t = focusDays.has(dayKey(now, timeZone)) ? now : now - DAY_MS
  let streak = 0
  while (focusDays.has(dayKey(t, timeZone))) {
    streak += 1
    t -= DAY_MS
  }
  return streak
}

/** Keeps the needs line light: the last point of each time slice. */
export function thinNeeds(rows: readonly StatRow[], from: number, to: number): NeedsPoint[] {
  const slice = Math.max(1, (to - from) / MAX_NEEDS_POINTS)
  const points = new Map<number, NeedsPoint>()
  for (const r of rows) {
    if (r.at < from || r.at > to) continue
    points.set(Math.floor((r.at - from) / slice), {
      at: r.at,
      hunger: r.hunger,
      happiness: r.happiness
    })
  }
  return [...points.values()].sort((a, b) => a.at - b.at)
}

export interface OverviewInput {
  pet: PetSummary
  /** Rows of this pet from at least FOCUS_WEEKS weeks back (and `days` back), oldest first. */
  rows: readonly StatRow[]
  /** Days with a completed focus (for the streak, may reach further back). */
  focusHistory: ReadonlySet<string>
  days: number
  now: number
  timeZone: string
}

export function buildOverview({
  pet,
  rows,
  focusHistory,
  days,
  now,
  timeZone
}: OverviewInput): Overview {
  const range = lastDays(now, timeZone, days)
  const from = dayStart(range[0] ?? dayKey(now, timeZone), timeZone)
  const care = new Map<string, CareDay>(
    range.map((d) => [d, { date: d, feed: 0, pet: 0, treat: 0 }])
  )
  const focusDays = new Map<string, number>(range.map((d) => [d, 0]))
  const weeks = new Map<string, number>()
  const lastWeek = weekStart(dayKey(now, timeZone))
  for (let i = FOCUS_WEEKS - 1; i >= 0; i--) {
    const [y, m, d] = lastWeek.split('-').map(Number) as [number, number, number]
    weeks.set(new Date(Date.UTC(y, m - 1, d) - i * 7 * DAY_MS).toISOString().slice(0, 10), 0)
  }
  const totals = { feed: 0, pet: 0, treat: 0, focus: 0 }

  for (const r of rows) {
    const day = dayKey(r.at, timeZone)
    const c = care.get(day)
    if (c && r.at >= from) {
      const kind =
        r.type === 'care.feed' && r.data['refused'] === false
          ? 'feed'
          : r.type === 'care.pet'
            ? 'pet'
            : r.type === 'care.treat'
              ? 'treat'
              : null
      if (kind) {
        c[kind] += 1
        totals[kind] += 1
      }
    }
    if (isCompletedFocus(r)) {
      if (focusDays.has(day) && r.at >= from) {
        focusDays.set(day, (focusDays.get(day) ?? 0) + 1)
        totals.focus++
      }
      const week = weekStart(day)
      if (weeks.has(week)) weeks.set(week, (weeks.get(week) ?? 0) + 1)
    }
  }

  const newest = rows.at(-1)
  const toCounts = (m: Map<string, number>): CountAt[] =>
    [...m].map(([date, count]) => ({ date, count }))
  return {
    pet,
    days,
    from,
    to: from + range.length * DAY_MS,
    dayKeys: range,
    last: newest
      ? { at: newest.at, hunger: newest.hunger, happiness: newest.happiness, mood: newest.mood }
      : null,
    needs: thinNeeds(rows, from, now),
    care: [...care.values()],
    focusDays: toCounts(focusDays),
    focusWeeks: toCounts(weeks),
    streak: focusStreak(focusHistory, now, timeZone),
    totals
  }
}
