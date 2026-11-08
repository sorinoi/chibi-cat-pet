/** Dates and times, shown in the server's time zone (FR-98). */
import type { EventRow } from '../../src/dashTypes.ts'
import type { Text } from './i18n.ts'

export function formatDateTime(ms: number, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(ms)
}

export function formatDate(ms: number, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium' }).format(ms)
}

/** A "YYYY-MM-DD" day key as a short label ("8 Nov"). */
export function formatDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short'
  }).format(Date.UTC(y, m - 1, d))
}

export const formatNeed = (v: number): string => `${Math.round(v)}`

/** The details column of the events table. */
export function eventDetail(row: EventRow, t: Text): string {
  const d = row.data
  const phase = (p: unknown): string => (typeof p === 'string' ? (t.phases[p] ?? p) : '–')
  switch (row.type) {
    case 'care.feed':
      return d['refused'] === true ? t.events.refused : ''
    case 'care.pet':
      return d['counted'] === false ? t.events.notCounted : ''
    case 'care.treat':
      return d['full'] === true ? t.events.wasFull : ''
    case 'treat.earned':
      return `+${String(d['count'])}`
    case 'pet.renamed':
      return `${String(d['from'])} → ${row.petName}`
    case 'focus.started':
      return `${phase(d['phase'])} · ${t.events.minutes(Number(d['minutes']))}`
    case 'focus.paused':
    case 'focus.resumed':
    case 'focus.skipped':
    case 'focus.stopped':
      return phase(d['phase'])
    case 'focus.phaseEnded':
      return `${phase(d['phase'])} · ${d['completed'] === true ? t.events.completed : t.events.interrupted}`
    default:
      return ''
  }
}
