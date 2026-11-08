/** The server process (pm2 runs dist/server.js). */
import { buildApp } from './app.ts'
import { readConfig } from './config.ts'
import { openDb } from './db.ts'
import { SERVER_VERSION } from './version.ts'

const config = readConfig()
const db = openDb(config.databaseUrl)
const app = buildApp({
  db,
  version: SERVER_VERSION,
  rateLimitPerMinute: config.rateLimitPerMinute,
  bodyLimitBytes: config.bodyLimitBytes,
  logger: true,
  dashboard: {
    timeZone: config.timeZone,
    sessionDays: config.sessionDays,
    cookieSecure: config.cookieSecure,
    loginsPerMinute: config.loginsPerMinute
  },
  webDir: config.webDir
})

async function stop(): Promise<void> {
  await app.close()
  await db.end()
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())

await app.listen({ host: config.host, port: config.port })
