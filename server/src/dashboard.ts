/**
 * requirement-v6.md FR-95..FR-98, NFR-35: login and the dashboard data API. Every route here
 * except login needs a live session cookie.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { RowDataPacket } from 'mysql2/promise'
import { ACTIVITY_TYPES } from '../../src/shared/activity.ts'
import { logIn, logOut, readCookie, SESSION_COOKIE, sessionCookie, sessionUser } from './auth.ts'
import {
  EVENT_PAGE_SIZE,
  OVERVIEW_DAYS,
  type EventPage,
  type EventRow,
  type Me,
  type Overview,
  type PetSummary
} from './dashTypes.ts'
import type { Db } from './db.ts'
import { createRateLimiter } from './rateLimit.ts'
import { buildOverview, dayKey, dayStart, FOCUS_WEEKS, type StatRow } from './stats.ts'

export interface DashboardOptions {
  db: Db
  timeZone: string
  sessionDays: number
  /** Secure cookies (https); off only for testing over plain http on this PC. */
  cookieSecure: boolean
  /** Login attempts per minute per address (NFR-35). */
  loginsPerMinute: number
  now?: () => number
}

const DAY_MS = 24 * 60 * 60_000
const STREAK_DAYS = 366
const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const toMs = (d: unknown): number => (d instanceof Date ? d.getTime() : Number(new Date(String(d))))
const jsonOf = (v: unknown): Record<string, unknown> => {
  const parsed: unknown = typeof v === 'string' ? JSON.parse(v) : v
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
}

function petOf(r: RowDataPacket): PetSummary {
  return {
    id: String(r['id']),
    name: String(r['name']),
    adoptedAt: toMs(r['adopted_at']),
    replacedAt: r['replaced_at'] ? toMs(r['replaced_at']) : null,
    lastEventAt: toMs(r['last_event_at'])
  }
}

function statOf(r: RowDataPacket): StatRow {
  return {
    type: String(r['type']),
    at: toMs(r['at']),
    hunger: Number(r['hunger']),
    happiness: Number(r['happiness']),
    mood: String(r['mood']),
    data: jsonOf(r['data'])
  }
}

export function registerDashboard(app: FastifyInstance, options: DashboardOptions): void {
  const { db, timeZone } = options
  const now = options.now ?? (() => Date.now())
  const loginLimiter = createRateLimiter(options.loginsPerMinute)
  const token = (request: FastifyRequest): string | null =>
    readCookie(request.headers.cookie, SESSION_COOKIE)

  /** The signed-in user, or a 401 already sent. */
  async function user(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const name = await sessionUser(db, token(request))
    if (!name) void reply.code(401).send({ error: 'Please log in' })
    return name
  }

  app.post('/api/v1/login', async (request, reply) => {
    if (!loginLimiter.allow(request.ip))
      return reply.code(429).send({ error: 'Too many tries; wait a minute' })
    const body = (request.body ?? {}) as { name?: unknown; password?: unknown }
    if (typeof body.name !== 'string' || typeof body.password !== 'string')
      return reply.code(400).send({ error: 'Name and password are needed' })
    const session = await logIn(
      db,
      body.name.slice(0, 50),
      body.password.slice(0, 200),
      options.sessionDays
    )
    if (!session) return reply.code(401).send({ error: 'Wrong name or password' })
    void reply.header(
      'Set-Cookie',
      sessionCookie(session.token, options.sessionDays * 24 * 60 * 60, options.cookieSecure)
    )
    return { name: session.userName, timeZone } satisfies Me
  })

  app.post('/api/v1/logout', async (request, reply) => {
    await logOut(db, token(request))
    void reply.header('Set-Cookie', sessionCookie('', 0, options.cookieSecure))
    return { ok: true }
  })

  app.get('/api/v1/me', async (request, reply) => {
    const name = await user(request, reply)
    if (!name) return reply
    return { name, timeZone } satisfies Me
  })

  async function pets(): Promise<PetSummary[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, name, adopted_at, replaced_at, last_event_at FROM pets
       ORDER BY replaced_at IS NULL DESC, last_event_at DESC`
    )
    return rows.map(petOf)
  }

  app.get('/api/v1/dash/pets', async (request, reply) => {
    if (!(await user(request, reply))) return reply
    return pets()
  })

  app.get('/api/v1/dash/overview', async (request, reply) => {
    if (!(await user(request, reply))) return reply
    const q = request.query as { pet?: string; days?: string }
    const days = OVERVIEW_DAYS.find((d) => String(d) === q.days) ?? OVERVIEW_DAYS[0]
    const all = await pets()
    const pet = q.pet ? all.find((p) => p.id === q.pet) : all[0]
    if (!pet) return reply.code(404).send({ error: 'No pet yet' })
    const t = now()
    const since = t - Math.max(days + 1, FOCUS_WEEKS * 7 + 7) * DAY_MS
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT type, at, hunger, happiness, mood, data FROM events
       WHERE pet_id = ? AND at >= ? ORDER BY at`,
      [pet.id, new Date(since)]
    )
    const [focus] = await db.query<RowDataPacket[]>(
      `SELECT at, data FROM events WHERE pet_id = ? AND type = 'focus.phaseEnded' AND at >= ?`,
      [pet.id, new Date(t - STREAK_DAYS * DAY_MS)]
    )
    const focusHistory = new Set(
      focus
        .filter((r) => {
          const d = jsonOf(r['data'])
          return d['phase'] === 'focus' && d['completed'] === true
        })
        .map((r) => dayKey(toMs(r['at']), timeZone))
    )
    return buildOverview({
      pet,
      rows: rows.map(statOf),
      focusHistory,
      days,
      now: t,
      timeZone
    }) satisfies Overview
  })

  app.get('/api/v1/dash/events', async (request, reply) => {
    if (!(await user(request, reply))) return reply
    const q = request.query as {
      pet?: string
      type?: string
      from?: string
      to?: string
      page?: string
    }
    const where: string[] = []
    const params: unknown[] = []
    const add = (clause: string, value: unknown): void => {
      where.push(clause)
      params.push(value)
    }
    if (q.pet && UUID.test(q.pet)) add('pet_id = ?', q.pet)
    if (q.type && (ACTIVITY_TYPES as readonly string[]).includes(q.type)) add('type = ?', q.type)
    if (q.from && DAY.test(q.from)) add('at >= ?', new Date(dayStart(q.from, timeZone)))
    if (q.to && DAY.test(q.to)) add('at < ?', new Date(dayStart(q.to, timeZone) + DAY_MS))
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const page = Math.max(1, Math.floor(Number(q.page) || 1))
    const [count] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM events ${filter}`,
      params
    )
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, type, at, tz_offset, pet_id, pet_name, hunger, happiness, mood, data FROM events
       ${filter} ORDER BY at DESC, id LIMIT ? OFFSET ?`,
      [...params, EVENT_PAGE_SIZE, (page - 1) * EVENT_PAGE_SIZE]
    )
    return {
      total: Number(count[0]?.['n'] ?? 0),
      page,
      size: EVENT_PAGE_SIZE,
      rows: rows.map((r): EventRow => ({
        id: String(r['id']),
        type: String(r['type']),
        at: toMs(r['at']),
        tz: Number(r['tz_offset']),
        petId: String(r['pet_id']),
        petName: String(r['pet_name']),
        hunger: Number(r['hunger']),
        happiness: Number(r['happiness']),
        mood: String(r['mood']),
        data: jsonOf(r['data'])
      }))
    } satisfies EventPage
  })
}
