import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { testEvent } from '../../src/main/lib/testActivity.ts'
import type { ActivityEvent } from '../../src/shared/activity.ts'
import { buildApp } from './app.ts'
import { createUser, logIn, sessionUser, setPassword } from './auth.ts'
import type { EventPage, Overview, PetSummary } from './dashTypes.ts'
import type { Db } from './db.ts'
import { createApiKey, storeEvents } from './store.ts'
import { freshTestDb, testDatabaseUrl } from './testDb.ts'

const url = testDatabaseUrl()
const HOUR = 60 * 60_000
const NOW = Date.UTC(2026, 10, 8, 5, 0, 0) // 12:00 in Bangkok
const PASSWORD = 'a-long-test-password'

describe.skipIf(!url)('login and dashboard API (requirement-v6.md FR-95..FR-97)', () => {
  let db: Db

  beforeEach(async () => {
    if (db) await db.end()
    db = await freshTestDb(url ?? '')
  })
  afterAll(async () => {
    await db?.end()
  })

  const app = () =>
    buildApp({
      db,
      version: '6.0.0',
      rateLimitPerMinute: 100,
      bodyLimitBytes: 256 * 1024,
      dashboard: {
        timeZone: 'Asia/Bangkok',
        sessionDays: 30,
        cookieSecure: true,
        loginsPerMinute: 3,
        now: () => NOW
      }
    })

  it('users: names and passwords are checked; a new password ends old sessions', async () => {
    await expect(createUser(db, 'bad name!', PASSWORD)).rejects.toThrow(/letters/)
    await expect(createUser(db, 'me', 'short')).rejects.toThrow(/at least/)
    await createUser(db, 'me', PASSWORD)
    expect(await logIn(db, 'me', 'wrong-password', 30)).toBeNull()
    expect(await logIn(db, 'nobody', PASSWORD, 30)).toBeNull()
    const session = await logIn(db, 'me', PASSWORD, 30)
    expect(await sessionUser(db, session?.token ?? null)).toBe('me')
    await setPassword(db, 'me', 'another-long-password')
    expect(await sessionUser(db, session?.token ?? null)).toBeNull()
  })

  it('login sets a strict cookie; every dashboard call needs it; logout ends it', async () => {
    await createUser(db, 'me', PASSWORD)
    const a = app()
    try {
      expect((await a.inject({ url: '/api/v1/me' })).statusCode).toBe(401)
      expect((await a.inject({ url: '/api/v1/dash/pets' })).statusCode).toBe(401)
      const wrong = await a.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: { name: 'me', password: 'nope-nope-nope' }
      })
      expect(wrong.statusCode).toBe(401)
      const ok = await a.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: { name: 'me', password: PASSWORD }
      })
      expect(ok.json()).toEqual({ name: 'me', timeZone: 'Asia/Bangkok' })
      const cookie = String(ok.headers['set-cookie'])
      expect(cookie).toMatch(
        /^dp_session=[\w-]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/
      )
      const headers = { cookie: cookie.split(';')[0] ?? '' }
      expect((await a.inject({ url: '/api/v1/me', headers })).json()).toMatchObject({ name: 'me' })
      await a.inject({ method: 'POST', url: '/api/v1/logout', headers, payload: {} })
      expect((await a.inject({ url: '/api/v1/me', headers })).statusCode).toBe(401)
    } finally {
      await a.close()
    }
  })

  it('too many logins from one address are refused (NFR-35)', async () => {
    const a = app()
    try {
      const codes: number[] = []
      for (let i = 0; i < 4; i++) {
        const res = await a.inject({
          method: 'POST',
          url: '/api/v1/login',
          payload: { name: 'x', password: 'y' }
        })
        codes.push(res.statusCode)
      }
      expect(codes).toEqual([401, 401, 401, 429])
    } finally {
      await a.close()
    }
  })

  it('pets, overview and events show what the app sent', async () => {
    await createUser(db, 'me', PASSWORD)
    const { id: keyId } = await createApiKey(db, 'test')
    const events: ActivityEvent[] = [
      { ...testEvent(NOW - 26 * HOUR, 1), type: 'care.feed', data: { refused: false } },
      {
        ...testEvent(NOW - 25 * HOUR, 2),
        type: 'focus.phaseEnded',
        data: { phase: 'focus', completed: true }
      },
      { ...testEvent(NOW - 2 * HOUR, 3), type: 'care.pet', data: { counted: true } },
      {
        ...testEvent(NOW - HOUR, 4),
        type: 'focus.phaseEnded',
        data: { phase: 'focus', completed: true }
      }
    ]
    await storeEvents(db, events, keyId)
    const a = app()
    try {
      const login = await a.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: { name: 'me', password: PASSWORD }
      })
      const headers = { cookie: String(login.headers['set-cookie']).split(';')[0] ?? '' }

      const pets = (await a.inject({ url: '/api/v1/dash/pets', headers })).json<PetSummary[]>()
      expect(pets.map((p) => p.name)).toEqual(['Mochi'])

      const o = (await a.inject({ url: '/api/v1/dash/overview?days=7', headers })).json<Overview>()
      expect(o.totals).toEqual({ feed: 1, pet: 1, treat: 0, focus: 2 })
      expect(o.streak).toBe(2)
      expect(o.focusDays.slice(-2)).toEqual([
        { date: '2026-11-07', count: 1 },
        { date: '2026-11-08', count: 1 }
      ])

      const all = (await a.inject({ url: '/api/v1/dash/events', headers })).json<EventPage>()
      expect(all.total).toBe(4)
      expect(all.rows[0]?.type).toBe('focus.phaseEnded') // newest first
      expect(all.rows[0]?.data).toEqual({ phase: 'focus', completed: true })
      const feeds = (
        await a.inject({ url: '/api/v1/dash/events?type=care.feed', headers })
      ).json<EventPage>()
      expect(feeds.rows.map((r) => r.type)).toEqual(['care.feed'])
      // Days are Bangkok days: only the two events of 8 November.
      const today = (
        await a.inject({ url: '/api/v1/dash/events?from=2026-11-08&to=2026-11-08', headers })
      ).json<EventPage>()
      expect(today.total).toBe(2)
    } finally {
      await a.close()
    }
  })
})
