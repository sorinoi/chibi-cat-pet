/**
 * requirement-v6.md NFR-38: server settings from the environment (.env on the VPS), with the
 * defaults here. Nothing else reads process.env.
 */
import { fileURLToPath } from 'node:url'

export interface ServerConfig {
  databaseUrl: string
  host: string
  port: number
  /** NFR-35: requests per minute per API key. */
  rateLimitPerMinute: number
  /** NFR-35: largest request body. */
  bodyLimitBytes: number
  /** FR-98: dates in the dashboard are counted in this IANA zone. */
  timeZone: string
  /** FR-95: how long a login lasts. */
  sessionDays: number
  /** FR-95: Secure cookies; turn off only for plain http on this PC. */
  cookieSecure: boolean
  /** NFR-35: login attempts per minute per address. */
  loginsPerMinute: number
  /** The built dashboard pages. */
  webDir: string
}

export const DEFAULTS = {
  host: '127.0.0.1',
  port: 3000,
  rateLimitPerMinute: 120,
  bodyLimitBytes: 256 * 1024,
  timeZone: 'Asia/Bangkok',
  sessionDays: 30,
  loginsPerMinute: 10,
  /** dist/web next to dist/server.js (and next to src/ in dev). */
  webDir: fileURLToPath(new URL('../dist/web', import.meta.url))
} as const

function whole(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive whole number`)
  return n
}

function zone(raw: string | undefined): string {
  const name = raw?.trim() || DEFAULTS.timeZone
  try {
    new Intl.DateTimeFormat('en', { timeZone: name })
  } catch {
    throw new Error(`TIME_ZONE "${name}" is not a known time zone (for example Asia/Bangkok)`)
  }
  return name
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env['DATABASE_URL']?.trim()
  if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)')
  return {
    databaseUrl,
    host: env['HOST']?.trim() || DEFAULTS.host,
    port: whole(env['PORT'], DEFAULTS.port, 'PORT'),
    rateLimitPerMinute: whole(
      env['RATE_LIMIT_PER_MINUTE'],
      DEFAULTS.rateLimitPerMinute,
      'RATE_LIMIT_PER_MINUTE'
    ),
    bodyLimitBytes: DEFAULTS.bodyLimitBytes,
    timeZone: zone(env['TIME_ZONE']),
    sessionDays: whole(env['SESSION_DAYS'], DEFAULTS.sessionDays, 'SESSION_DAYS'),
    cookieSecure: env['COOKIE_SECURE']?.trim().toLowerCase() !== 'false',
    loginsPerMinute: DEFAULTS.loginsPerMinute,
    webDir: env['WEB_DIR']?.trim() || DEFAULTS.webDir
  }
}
