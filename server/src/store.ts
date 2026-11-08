/**
 * requirement-v6.md FR-86, FR-91, FR-93: storing event batches and API keys.
 */
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { ActivityEvent } from '../../src/shared/activity.ts'
import type { Db } from './db.ts'
import { hashApiKey, newApiKey, shownPrefix } from './keys.ts'

export interface StoreResult {
  stored: number
  skipped: number
}

const ER_DUP_ENTRY = 1062

/** The newest event of each group (events sorted by time). */
function latestBy<K>(
  events: readonly ActivityEvent[],
  key: (e: ActivityEvent) => K
): ActivityEvent[] {
  const latest = new Map<K, ActivityEvent>()
  for (const e of events) {
    const seen = latest.get(key(e))
    if (!seen || e.at >= seen.at) latest.set(key(e), e)
  }
  return [...latest.values()]
}

async function storeIn(
  conn: PoolConnection,
  events: readonly ActivityEvent[],
  apiKeyId: number,
  receivedAt: Date
): Promise<StoreResult> {
  // FR-86: an event id is stored once; a re-sent batch skips what is already there.
  const [existing] = await conn.query<RowDataPacket[]>('SELECT id FROM events WHERE id IN (?)', [
    events.map((e) => e.id)
  ])
  const known = new Set(existing.map((r) => String(r['id'])))
  const fresh = events.filter(
    (e, i) => !known.has(e.id) && events.findIndex((o) => o.id === e.id) === i
  )

  for (const e of latestBy(events, (x) => x.device)) {
    const at = new Date(e.at)
    await conn.query(
      `INSERT INTO devices (id, app_version, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         app_version = IF(? >= last_seen_at, ?, app_version),
         last_seen_at = GREATEST(last_seen_at, ?)`,
      [e.device, e.app, at, at, at, e.app, at]
    )
  }

  for (const e of latestBy(events, (x) => x.pet.id)) {
    const at = new Date(e.at)
    await conn.query(
      `INSERT INTO pets (id, name, adopted_at, device_id, first_seen_at, last_event_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = IF(? >= last_event_at, ?, name),
         last_event_at = GREATEST(last_event_at, ?)`,
      [e.pet.id, e.pet.name, new Date(e.pet.adoptedAt), e.device, at, at, at, e.pet.name, at]
    )
  }
  for (const e of events) {
    if (e.type !== 'pet.replaced') continue
    await conn.query('UPDATE pets SET replaced_at = ? WHERE id = ?', [new Date(e.at), e.pet.id])
  }

  if (fresh.length > 0) {
    await conn.query(
      `INSERT INTO events (id, type, schema_version, pet_id, device_id, at, tz_offset, app_version,
         pet_name, hunger, happiness, mood, data, received_at, api_key_id) VALUES ?`,
      [
        fresh.map((e) => [
          e.id,
          e.type,
          e.v,
          e.pet.id,
          e.device,
          new Date(e.at),
          e.tz,
          e.app,
          e.pet.name,
          e.pet.hunger,
          e.pet.happiness,
          e.pet.mood,
          JSON.stringify(e.data),
          receivedAt,
          apiKeyId
        ])
      ]
    )
  }
  return { stored: fresh.length, skipped: events.length - fresh.length }
}

/** FR-91: stores one checked batch in one transaction. */
export async function storeEvents(
  db: Db,
  events: readonly ActivityEvent[],
  apiKeyId: number,
  receivedAt: Date = new Date()
): Promise<StoreResult> {
  const sorted = [...events].sort((a, b) => a.at - b.at)
  // Two requests with the same new ids at once: the second one hits a duplicate; try again.
  for (let attempt = 0; ; attempt++) {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const result = await storeIn(conn, sorted, apiKeyId, receivedAt)
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback()
      const code = (err as { errno?: number }).errno
      if (code !== ER_DUP_ENTRY || attempt > 0) throw err
    } finally {
      conn.release()
    }
  }
}

// --- API keys (FR-93) ---------------------------------------------------------------

export interface ApiKeyRow {
  id: number
  label: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

/** Makes a key; the key itself is returned only here, once. */
export async function createApiKey(db: Db, label: string): Promise<{ id: number; key: string }> {
  const clean = label.trim().slice(0, 100)
  if (clean === '') throw new Error('A key needs a label, for example "home PC"')
  const key = newApiKey()
  const [result] = await db.query<ResultSetHeader>(
    'INSERT INTO api_keys (label, prefix, hash, created_at) VALUES (?, ?, ?, ?)',
    [clean, shownPrefix(key), hashApiKey(key), new Date()]
  )
  return { id: result.insertId, key }
}

export async function listApiKeys(db: Db): Promise<ApiKeyRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, label, prefix, created_at, last_used_at, revoked_at FROM api_keys ORDER BY id'
  )
  return rows.map((r) => ({
    id: Number(r['id']),
    label: String(r['label']),
    prefix: String(r['prefix']),
    createdAt: r['created_at'] as Date,
    lastUsedAt: (r['last_used_at'] as Date | null) ?? null,
    revokedAt: (r['revoked_at'] as Date | null) ?? null
  }))
}

/** Revokes by id or by the shown prefix. Returns how many keys were revoked. */
export async function revokeApiKey(db: Db, idOrPrefix: string): Promise<number> {
  const asId = /^\d+$/.test(idOrPrefix) ? Number(idOrPrefix) : -1
  const [result] = await db.query<ResultSetHeader>(
    'UPDATE api_keys SET revoked_at = ? WHERE revoked_at IS NULL AND (id = ? OR prefix = ?)',
    [new Date(), asId, idOrPrefix]
  )
  return result.affectedRows
}

/** The id of a usable key, or null; marks it used. */
export async function checkApiKey(db: Db, key: string): Promise<number | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id FROM api_keys WHERE hash = ? AND revoked_at IS NULL',
    [hashApiKey(key)]
  )
  const id = rows[0]?.['id']
  if (id === undefined) return null
  await db.query('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [new Date(), id])
  return Number(id)
}
