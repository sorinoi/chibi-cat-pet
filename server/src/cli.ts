/**
 * requirement-v6.md FR-93, FR-94: server commands.
 *   migrate                apply new files from migrations/
 *   key:create <label>     make an API key (shown once)
 *   key:list               list keys (prefix only)
 *   key:revoke <id|prefix> stop a key from working
 *   user:create <name>     make a dashboard user with a new password (shown once)
 *   user:password <name>   give a user a new password (shown once) and log them out
 *   user:list, user:delete <name>
 */
import { createUser, deleteUser, listUsers, newPassword, setPassword } from './auth.ts'
import { readConfig } from './config.ts'
import { MIGRATIONS_DIR, migrate, openDb } from './db.ts'
import { createApiKey, listApiKeys, revokeApiKey } from './store.ts'

const when = (d: Date | null): string => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '-')

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv
  const db = openDb(readConfig().databaseUrl)
  try {
    switch (command) {
      case 'migrate': {
        const applied = await migrate(db, MIGRATIONS_DIR)
        console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Already up to date')
        return 0
      }
      case 'key:create': {
        const { id, key } = await createApiKey(db, args.join(' '))
        console.log(`Key ${id} made. Copy it now; it is not shown again:\n\n  ${key}\n`)
        console.log('Paste it into Desktop Pet: Settings > Activity log > API key.')
        return 0
      }
      case 'key:list': {
        const keys = await listApiKeys(db)
        if (keys.length === 0)
          console.log('No keys yet. Make one with: npm run key:create -- <label>')
        for (const k of keys) {
          const state = k.revokedAt ? `revoked ${when(k.revokedAt)}` : 'active'
          console.log(
            `${k.id}\tdp_${k.prefix}…\t${k.label}\tcreated ${when(k.createdAt)}\tlast used ${when(k.lastUsedAt)}\t${state}`
          )
        }
        return 0
      }
      case 'key:revoke': {
        const target = args[0]
        if (!target) throw new Error('Usage: npm run key:revoke -- <id or prefix>')
        const count = await revokeApiKey(db, target)
        console.log(count ? `Revoked ${count} key(s)` : 'No active key matched')
        return count ? 0 : 1
      }
      case 'user:create': {
        const name = args[0] ?? ''
        const password = newPassword()
        await createUser(db, name, password)
        console.log(`User "${name}" made. The password is shown only now:\n\n  ${password}\n`)
        return 0
      }
      case 'user:password': {
        const name = args[0] ?? ''
        const password = newPassword()
        if (!(await setPassword(db, name, password))) throw new Error(`No user "${name}"`)
        console.log(
          `New password for "${name}" (shown only now; old logins ended):\n\n  ${password}\n`
        )
        return 0
      }
      case 'user:list': {
        const users = await listUsers(db)
        if (users.length === 0)
          console.log('No users yet. Make one with: npm run user:create -- <name>')
        for (const u of users) console.log(`${u.id}\t${u.name}\tcreated ${when(u.createdAt)}`)
        return 0
      }
      case 'user:delete': {
        const name = args[0] ?? ''
        const gone = await deleteUser(db, name)
        console.log(gone ? `Deleted "${name}"` : `No user "${name}"`)
        return gone ? 0 : 1
      }
      default:
        console.error(
          'Commands: migrate, key:create <label>, key:list, key:revoke <id|prefix>, user:create <name>, user:password <name>, user:list, user:delete <name>'
        )
        return 1
    }
  } finally {
    await db.end()
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
)
