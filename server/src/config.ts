/**
 * requirement-v6.md NFR-38: server settings from the environment (.env on the VPS), with the
 * defaults here. Nothing else reads process.env.
 */
export interface ServerConfig {
  databaseUrl: string
  host: string
  port: number
  /** NFR-35: requests per minute per API key. */
  rateLimitPerMinute: number
  /** NFR-35: largest request body. */
  bodyLimitBytes: number
}

export const DEFAULTS = {
  host: '127.0.0.1',
  port: 3000,
  rateLimitPerMinute: 120,
  bodyLimitBytes: 256 * 1024
} as const

function whole(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive whole number`)
  return n
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
    bodyLimitBytes: DEFAULTS.bodyLimitBytes
  }
}
