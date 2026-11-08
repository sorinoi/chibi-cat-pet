/**
 * requirement-v6.md FR-80, FR-81, FR-99: the activity events the app sends to the user's own
 * server. The one contract both sides use: the app builds events with it, the server
 * (server/) checks them with parseActivityEvent. Pure, no imports, unit tested.
 */

/** Bump when an event changes shape; the server keeps accepting older versions. */
export const ACTIVITY_SCHEMA_VERSION = 1

/** Most events in one POST /api/v1/events request (FR-84). */
export const ACTIVITY_MAX_BATCH = 100

export const ACTIVITY_PATHS = {
  events: '/api/v1/events',
  health: '/api/v1/health'
} as const

export const ACTIVITY_MOODS = ['hungry', 'sad', 'happy', 'content'] as const
export type ActivityMood = (typeof ACTIVITY_MOODS)[number]

export const FOCUS_PHASES = ['focus', 'shortBreak', 'longBreak'] as const
export type ActivityFocusPhase = (typeof FOCUS_PHASES)[number]

/** Type-specific fields of each event (FR-80). */
export interface ActivityData {
  'pet.adopted': Record<string, never>
  /** `from` is the old name; the new one is in `pet.name`. */
  'pet.renamed': { from: string }
  /** The pet was wiped locally for a new adoption; this is its last event. */
  'pet.replaced': Record<string, never>
  'care.feed': { refused: boolean }
  /** Every pet action, stroke or menu; `counted` says whether it raised happiness. */
  'care.pet': { counted: boolean }
  /** A treat was given; `full` when the cat was already full. */
  'care.treat': { full: boolean }
  'treat.earned': { count: number }
  /** A focus or break phase started, by the user or automatically. */
  'focus.started': { phase: ActivityFocusPhase; minutes: number }
  'focus.paused': { phase: ActivityFocusPhase }
  'focus.resumed': { phase: ActivityFocusPhase }
  /** The user skipped the phase; it does not count. */
  'focus.skipped': { phase: ActivityFocusPhase }
  /** The user stopped the timer; `phase` is null when it was only waiting between phases. */
  'focus.stopped': { phase: ActivityFocusPhase | null }
  /** A phase ran out (`completed`), or a focus was cut short because the PC slept. */
  'focus.phaseEnded': { phase: ActivityFocusPhase; completed: boolean }
}

export type ActivityType = keyof ActivityData

/** One thing that happened, before it gets the event envelope (id, time, pet, ...). */
export type ActivityItem<T extends ActivityType = ActivityType> = {
  [K in T]: { type: K; data: ActivityData[K] }
}[T]

export type CareActivityType = Extract<
  ActivityType,
  `pet.${string}` | `care.${string}` | `treat.${string}`
>
export type FocusActivityType = Extract<ActivityType, `focus.${string}`>

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'pet.adopted',
  'pet.renamed',
  'pet.replaced',
  'care.feed',
  'care.pet',
  'care.treat',
  'treat.earned',
  'focus.started',
  'focus.paused',
  'focus.resumed',
  'focus.skipped',
  'focus.stopped',
  'focus.phaseEnded'
]

/** The pet right after the action (FR-81). */
export interface ActivityPet {
  /** Random UUID made at adoption (FR-82). */
  id: string
  name: string
  /** Epoch ms. */
  adoptedAt: number
  hunger: number
  happiness: number
  mood: ActivityMood
}

interface ActivityEventOf<T extends ActivityType> {
  /** Schema version (ACTIVITY_SCHEMA_VERSION when made). */
  v: number
  /** Random UUID; the server stores each id once (FR-86). */
  id: string
  type: T
  /** UTC epoch ms. */
  at: number
  /** The PC's offset from UTC in minutes at that moment (Bangkok: 420). */
  tz: number
  /** Random UUID per install (FR-82). */
  device: string
  /** App version that made the event. */
  app: string
  pet: ActivityPet
  data: ActivityData[T]
}

export type ActivityEvent = { [T in ActivityType]: ActivityEventOf<T> }[ActivityType]

// --- Checks (used by the server, and by the app when it reads its outbox) ---------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TEXT = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isNeed = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const isPhase = (v: unknown): v is ActivityFocusPhase =>
  (FOCUS_PHASES as readonly unknown[]).includes(v)
const isType = (v: unknown): v is ActivityType => (ACTIVITY_TYPES as readonly unknown[]).includes(v)
const isOffset = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 14 * 60

function isPet(v: unknown): v is ActivityPet {
  if (!isRecord(v)) return false
  return (
    isUuid(v['id']) &&
    isText(v['name']) &&
    isTime(v['adoptedAt']) &&
    isNeed(v['hunger']) &&
    isNeed(v['happiness']) &&
    (ACTIVITY_MOODS as readonly unknown[]).includes(v['mood'])
  )
}

/** Checks the type-specific fields; extra fields are not allowed. */
function isData(type: ActivityType, d: unknown): boolean {
  if (!isRecord(d)) return false
  const keys = Object.keys(d).sort().join(',')
  switch (type) {
    case 'pet.adopted':
    case 'pet.replaced':
      return keys === ''
    case 'pet.renamed':
      return keys === 'from' && isText(d['from'])
    case 'care.feed':
      return keys === 'refused' && isBool(d['refused'])
    case 'care.pet':
      return keys === 'counted' && isBool(d['counted'])
    case 'care.treat':
      return keys === 'full' && isBool(d['full'])
    case 'treat.earned':
      return keys === 'count' && isTime(d['count'])
    case 'focus.started':
      return keys === 'minutes,phase' && isPhase(d['phase']) && isTime(d['minutes'])
    case 'focus.paused':
    case 'focus.resumed':
    case 'focus.skipped':
      return keys === 'phase' && isPhase(d['phase'])
    case 'focus.stopped':
      return keys === 'phase' && (d['phase'] === null || isPhase(d['phase']))
    case 'focus.phaseEnded':
      return keys === 'completed,phase' && isPhase(d['phase']) && isBool(d['completed'])
  }
}

/** A stored or received event, or null when anything about it is wrong (FR-91). */
export function parseActivityEvent(raw: unknown): ActivityEvent | null {
  if (!isRecord(raw)) return null
  const { v, id, type, at, tz, device, app, pet, data } = raw
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > ACTIVITY_SCHEMA_VERSION)
    return null
  if (!isUuid(id) || !isType(type) || !isTime(at) || !isOffset(tz)) return null
  if (!isUuid(device) || !isText(app) || !isPet(pet) || !isData(type, data)) return null
  return { v, id, type, at, tz, device, app, pet, data } as ActivityEvent
}

// --- Server URL (requirement-v6.md section 7) -----------------------------------------

export type ServerUrlCheck =
  { ok: true; url: string } | { ok: false; reason: 'empty' | 'invalid' | 'notHttps' }

/** Private LAN and loopback addresses that may use plain http (section 7). */
function isLocalHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === 'localhost' || h === '::1') return true
  const parts = h.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
    return false
  const [a, b] = parts as [number, number, number, number]
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

/**
 * The server URL the user typed: https anywhere, http only for localhost and private LAN
 * addresses. Returns the base URL without a trailing slash, query or fragment.
 */
export function checkServerUrl(raw: string): ServerUrlCheck {
  const text = raw.trim()
  if (text === '') return { ok: false, reason: 'empty' }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (url.username || url.password || (url.protocol !== 'https:' && url.protocol !== 'http:'))
    return { ok: false, reason: 'invalid' }
  if (url.protocol === 'http:' && !isLocalHost(url.hostname))
    return { ok: false, reason: 'notHttps' }
  return { ok: true, url: `${url.origin}${url.pathname.replace(/\/+$/, '')}` }
}
