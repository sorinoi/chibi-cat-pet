/**
 * requirement-v6.md FR-94: the MySQL / MariaDB connection and the migration runner. Times go
 * in and out as UTC (`timezone: 'Z'`).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise'

export type Db = Pool

/** migrations/ sits next to src/ and dist/ alike. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url))

export function openDb(url: string): Db {
  return mysql.createPool({
    uri: url,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    connectionLimit: 5,
    // Only one statement per query (migrations are split below).
    multipleStatements: false
  })
}

/** Splits a migration file into statements (our files have no `;` inside strings). */
export function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/** Applies the .sql files in `dir` that have not run yet, in name order. Returns their names. */
export async function migrate(db: Db, dir: string): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(200) NOT NULL PRIMARY KEY,
       applied_at DATETIME(3) NOT NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  const [rows] = await db.query<RowDataPacket[]>('SELECT name FROM schema_migrations')
  const done = new Set(rows.map((r) => String(r['name'])))
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const applied: string[] = []
  for (const file of files) {
    if (done.has(file)) continue
    // MySQL commits each CREATE TABLE on its own, so a failed file stops here, unrecorded.
    for (const statement of splitStatements(readFileSync(join(dir, file), 'utf8'))) {
      await db.query(statement)
    }
    await db.query('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', [
      file,
      new Date()
    ])
    applied.push(file)
  }
  return applied
}
