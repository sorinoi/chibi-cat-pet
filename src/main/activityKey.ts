import { safeStorage } from 'electron'
import { readFileSync, rmSync, writeFileSync, renameSync, existsSync } from 'node:fs'

/**
 * requirement-v6.md NFR-34: the activity API key, encrypted with Windows' safeStorage (DPAPI,
 * tied to this Windows user) in its own file. Kept in memory once read; never logged.
 */
export interface ActivityKeyStore {
  get(): string | null
  has(): boolean
  /** Stores the key; an empty string removes it. False when it could not be stored safely. */
  set(key: string): boolean
}

/** Longest key accepted (the server makes keys far shorter). */
const MAX_KEY_LENGTH = 200

export function createActivityKeyStore(path: string): ActivityKeyStore {
  let cached: string | null | undefined

  function read(): string | null {
    if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(readFileSync(path))
    } catch {
      console.warn('The stored activity key could not be read; enter it again in Settings.')
      return null
    }
  }

  return {
    get() {
      if (cached === undefined) cached = read()
      return cached
    },
    has() {
      return this.get() !== null
    },
    set(key) {
      const clean = key.trim()
      if (clean === '') {
        rmSync(path, { force: true })
        cached = null
        return true
      }
      if (clean.length > MAX_KEY_LENGTH || !safeStorage.isEncryptionAvailable()) return false
      try {
        const tmp = `${path}.tmp`
        writeFileSync(tmp, safeStorage.encryptString(clean))
        renameSync(tmp, path)
      } catch (err) {
        console.error('Could not store the activity key:', err instanceof Error ? err.message : err)
        return false
      }
      cached = clean
      return true
    }
  }
}
