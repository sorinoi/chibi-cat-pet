/** Test helper (only imported by tests): an emptied, migrated test database. */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MIGRATIONS_DIR, migrate, openDb, type Db } from './db.ts'

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url))

/** TEST_DATABASE_URL from the environment or server/.env; null when not set. */
export function testDatabaseUrl(): string | null {
  if (!process.env['TEST_DATABASE_URL'] && existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)
  return process.env['TEST_DATABASE_URL']?.trim() || null
}

const TABLES = ['events', 'pets', 'devices', 'api_keys', 'schema_migrations']

/** Drops every table and runs the migrations. Refuses any database not named *_test. */
export async function freshTestDb(url: string): Promise<Db> {
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!name.endsWith('_test'))
    throw new Error(`Refusing to empty "${name}": tests need a *_test database`)
  const db = openDb(url)
  for (const table of TABLES) await db.query(`DROP TABLE IF EXISTS \`${table}\``)
  await migrate(db, MIGRATIONS_DIR)
  return db
}
