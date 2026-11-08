import type { RowDataPacket } from 'mysql2/promise'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { testEvent } from '../../src/main/lib/testActivity.ts'
import type { ActivityEvent } from '../../src/shared/activity.ts'
import { buildApp } from './app.ts'
import { MIGRATIONS_DIR, migrate, type Db } from './db.ts'
import { checkApiKey, createApiKey, listApiKeys, revokeApiKey, storeEvents } from './store.ts'
import { freshTestDb, testDatabaseUrl } from './testDb.ts'

const url = testDatabaseUrl()
if (!url)
  console.warn('TEST_DATABASE_URL is not set: database tests are skipped (see .env.example)')

const T0 = 1_794_000_000_000
const PET = '11111111-2222-4333-8444-555555555555'

describe.skipIf(!url)('database (requirement-v6.md FR-86, FR-91..FR-94)', () => {
  let db: Db
  const rows = async (sql: string, params: unknown[] = []): Promise<RowDataPacket[]> =>
    (await db.query<RowDataPacket[]>(sql, params))[0]

  beforeEach(async () => {
    if (db) await db.end()
    db = await freshTestDb(url ?? '')
  })
  afterAll(async () => {
    await db?.end()
  })

  it('migrations run once', async () => {
    expect(await migrate(db, MIGRATIONS_DIR)).toEqual([])
    const tables = (await rows('SHOW TABLES')).map((r) => String(Object.values(r)[0]))
    expect(tables.sort()).toEqual([
      'api_keys',
      'devices',
      'events',
      'pets',
      'schema_migrations',
      'sessions',
      'users'
    ])
  })

  it('stores a batch, keeps each event id once, and tracks the pet and device', async () => {
    const { id: keyId } = await createApiKey(db, 'test')
    const a = testEvent(T0, 1)
    const b: ActivityEvent = {
      ...testEvent(T0 + 1000, 2),
      type: 'care.feed',
      data: { refused: false }
    }
    expect(await storeEvents(db, [a, b], keyId)).toEqual({ stored: 2, skipped: 0 })
    // FR-86: the same batch again (the answer got lost) adds nothing.
    expect(await storeEvents(db, [b, a], keyId)).toEqual({ stored: 0, skipped: 2 })
    const events = await rows('SELECT id, type, at, hunger, data, pet_name FROM events ORDER BY at')
    expect(events.map((e) => e['type'])).toEqual(['care.pet', 'care.feed'])
    expect((events[0]?.['at'] as Date).getTime()).toBe(T0)
    expect(Number(events[0]?.['hunger'])).toBe(80)
    const data = events[1]?.['data']
    expect(typeof data === 'string' ? JSON.parse(data) : data).toEqual({ refused: false })
    const pets = await rows('SELECT id, name, replaced_at FROM pets')
    expect(pets).toEqual([{ id: PET, name: 'Mochi', replaced_at: null }])
    expect((await rows('SELECT app_version FROM devices'))[0]?.['app_version']).toBe('6.0.0')
  })

  it('takes the pet name from its newest event and marks a replaced pet', async () => {
    const { id: keyId } = await createApiKey(db, 'test')
    const renamed: ActivityEvent = {
      ...testEvent(T0 + 5000, 3),
      type: 'pet.renamed',
      pet: { ...testEvent(T0, 3).pet, name: 'ส้มจี๊ด' },
      data: { from: 'Mochi' }
    }
    const older = testEvent(T0, 4) // still "Mochi", arrives late
    await storeEvents(db, [renamed], keyId)
    await storeEvents(db, [older], keyId)
    expect((await rows('SELECT name FROM pets'))[0]?.['name']).toBe('ส้มจี๊ด')
    const replaced: ActivityEvent = { ...testEvent(T0 + 9000, 5), type: 'pet.replaced', data: {} }
    await storeEvents(db, [replaced], keyId)
    const pet = (await rows('SELECT replaced_at FROM pets'))[0]
    expect((pet?.['replaced_at'] as Date).getTime()).toBe(T0 + 9000)
  })

  it('keys: only the hash is stored; revoked keys stop working', async () => {
    const { key } = await createApiKey(db, 'home PC')
    expect(JSON.stringify(await rows('SELECT * FROM api_keys'))).not.toContain(key)
    const id = await checkApiKey(db, key)
    expect(id).not.toBeNull()
    expect((await listApiKeys(db))[0]?.lastUsedAt).toBeInstanceOf(Date)
    expect(await checkApiKey(db, 'dp_wrong')).toBeNull()
    expect(await revokeApiKey(db, String(id))).toBe(1)
    expect(await checkApiKey(db, key)).toBeNull()
  })

  it('API: health and events need a good key; bad data is refused; duplicates skipped', async () => {
    const { key } = await createApiKey(db, 'test')
    const app = buildApp({
      db,
      version: '6.0.0',
      rateLimitPerMinute: 100,
      bodyLimitBytes: 256 * 1024
    })
    const auth = { authorization: `Bearer ${key}` }
    try {
      expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(401)
      const health = await app.inject({ method: 'GET', url: '/api/v1/health', headers: auth })
      expect(health.json()).toEqual({ ok: true, version: '6.0.0' })

      const batch = { events: [testEvent(T0, 1), testEvent(T0 + 1, 2)] }
      const post = (body: unknown, headers = auth) =>
        app.inject({ method: 'POST', url: '/api/v1/events', headers, payload: body as object })
      expect((await post(batch, { authorization: 'Bearer dp_nope' })).statusCode).toBe(401)
      const first = await post(batch)
      expect(first.statusCode).toBe(200)
      expect(first.json()).toEqual({ stored: 2, skipped: 0 })
      expect((await post(batch)).json()).toEqual({ stored: 0, skipped: 2 })
      const bad = await post({ events: [{ ...testEvent(T0, 3), type: 'care.click' }] })
      expect(bad.statusCode).toBe(400)
      expect((await rows('SELECT COUNT(*) AS n FROM events'))[0]?.['n']).toBe(2)
    } finally {
      await app.close()
    }
  })

  it('API: a body over the limit and too many requests are refused (NFR-35)', async () => {
    const { key } = await createApiKey(db, 'test')
    const app = buildApp({ db, version: '6.0.0', rateLimitPerMinute: 2, bodyLimitBytes: 1024 })
    const headers = { authorization: `Bearer ${key}` }
    try {
      const big = { events: Array.from({ length: 10 }, (_, i) => testEvent(T0, i + 1)) }
      const tooBig = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        headers,
        payload: big
      })
      expect(tooBig.statusCode).toBe(413)
      // The too-big body was refused before the key check, so it did not count.
      await app.inject({ method: 'GET', url: '/api/v1/health', headers })
      await app.inject({ method: 'GET', url: '/api/v1/health', headers })
      const third = await app.inject({ method: 'GET', url: '/api/v1/health', headers })
      expect(third.statusCode).toBe(429)
    } finally {
      await app.close()
    }
  })
})
