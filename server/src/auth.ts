/**
 * requirement-v6.md FR-95, NFR-35: dashboard users and sessions, with Node built-ins only.
 * Passwords use scrypt; a session is a random cookie whose SHA-256 is kept in the database.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Db } from './db.ts'

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64, saltBytes: 16 } as const
export const SESSION_COOKIE = 'dp_session'
export const MIN_PASSWORD_LENGTH = 10

function scryptAsync(
  password: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, SCRYPT.keyLength, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT.saltBytes)
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p)
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    key.toString('base64')
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    Number(n),
    Number(r),
    Number(p)
  )
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** A password made for the user (shown once by `user:create` and `user:password`). */
export function newPassword(): string {
  return randomBytes(12).toString('base64url')
}

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex')

// --- Users ------------------------------------------------------------------------

const NAME = /^[A-Za-z0-9._-]{1,50}$/

export async function createUser(db: Db, name: string, password: string): Promise<number> {
  if (!NAME.test(name))
    throw new Error('User names use letters, digits, dot, dash or underscore (1-50)')
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters`)
  const [result] = await db.query<ResultSetHeader>(
    'INSERT INTO users (name, password_hash, created_at) VALUES (?, ?, ?)',
    [name, await hashPassword(password), new Date()]
  )
  return result.insertId
}

/** Sets a new password and ends the user's sessions. False when there is no such user. */
export async function setPassword(db: Db, name: string, password: string): Promise<boolean> {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters`)
  const [result] = await db.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE name = ?',
    [await hashPassword(password), name]
  )
  if (result.affectedRows === 0) return false
  await db.query('DELETE s FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.name = ?', [
    name
  ])
  return true
}

export async function listUsers(
  db: Db
): Promise<Array<{ id: number; name: string; createdAt: Date }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, name, created_at FROM users ORDER BY id'
  )
  return rows.map((r) => ({
    id: Number(r['id']),
    name: String(r['name']),
    createdAt: r['created_at'] as Date
  }))
}

export async function deleteUser(db: Db, name: string): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>('DELETE FROM users WHERE name = ?', [name])
  return result.affectedRows > 0
}

// --- Sessions ---------------------------------------------------------------------

/** Checks the password; returns a new session token, or null. */
export async function logIn(
  db: Db,
  name: string,
  password: string,
  sessionDays: number
): Promise<{ token: string; userName: string } | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, name, password_hash FROM users WHERE name = ?',
    [name]
  )
  const user = rows[0]
  // Hash anyway when the user does not exist, so the answer takes the same time.
  const stored = user ? String(user['password_hash']) : await DUMMY_HASH
  const ok = await verifyPassword(password, stored)
  if (!user || !ok) return null
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [tokenHash(token), user['id'], now, new Date(now.getTime() + sessionDays * 24 * 60 * 60_000)]
  )
  // Old sessions of anyone are cleaned up now and then.
  await db.query('DELETE FROM sessions WHERE expires_at < ?', [now])
  return { token, userName: String(user['name']) }
}

const DUMMY_HASH = hashPassword(newPassword())

/** The user of a live session, or null. */
export async function sessionUser(db: Db, token: string | null): Promise<string | null> {
  if (!token) return null
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash(token), new Date()]
  )
  const name = rows[0]?.['name']
  return name === undefined ? null : String(name)
}

export async function logOut(db: Db, token: string | null): Promise<void> {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash(token)])
}

// --- Cookies ----------------------------------------------------------------------

/** One cookie's value from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

/** Set-Cookie for the session: HttpOnly, SameSite=Strict, Secure unless turned off for local http. */
export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : [])
  ].join('; ')
}
