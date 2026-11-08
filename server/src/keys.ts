/**
 * requirement-v6.md FR-93, NFR-35: API keys. A key is shown once when made; the database keeps
 * only its SHA-256 hash (keys are long and random, so a plain hash is enough) and a short
 * prefix to tell keys apart in lists.
 */
import { createHash, randomBytes } from 'node:crypto'

const KEY_PREFIX = 'dp_'
const KEY_BYTES = 32
/** Characters of the key shown in lists (after "dp_"). */
export const SHOWN_PREFIX_LENGTH = 8

export function newApiKey(): string {
  return KEY_PREFIX + randomBytes(KEY_BYTES).toString('base64url')
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

export function shownPrefix(key: string): string {
  return key.slice(KEY_PREFIX.length, KEY_PREFIX.length + SHOWN_PREFIX_LENGTH)
}

/** The key from an `Authorization: Bearer <key>` header, or null. */
export function bearerKey(header: string | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S{1,200})$/i.exec(header.trim())
  return match?.[1] ?? null
}
