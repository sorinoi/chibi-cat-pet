import { describe, expect, it } from 'vitest'
import { testEvent } from '../../src/main/lib/testActivity.ts'
import { checkBatch } from './app.ts'
import { readConfig } from './config.ts'
import { splitStatements } from './db.ts'
import { bearerKey, hashApiKey, newApiKey, shownPrefix } from './keys.ts'
import { createRateLimiter } from './rateLimit.ts'

describe('API keys (requirement-v6.md FR-93)', () => {
  it('are long, random and stored only as a hash', () => {
    const a = newApiKey()
    const b = newApiKey()
    expect(a).toMatch(/^dp_[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    expect(hashApiKey(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashApiKey(a)).toBe(hashApiKey(a))
    expect(shownPrefix(a)).toBe(a.slice(3, 11))
  })

  it('reads a Bearer header and nothing else', () => {
    expect(bearerKey('Bearer dp_abc')).toBe('dp_abc')
    expect(bearerKey('bearer  dp_abc ')).toBe('dp_abc')
    expect(bearerKey('Basic dp_abc')).toBeNull()
    expect(bearerKey('Bearer a b')).toBeNull()
    expect(bearerKey(undefined)).toBeNull()
  })
})

describe('rate limit (NFR-35)', () => {
  it('allows N per window per key, then waits for the next window', () => {
    let t = 0
    const limit = createRateLimiter(2, 60_000, () => t)
    expect([limit.allow('a'), limit.allow('a'), limit.allow('a')]).toEqual([true, true, false])
    expect(limit.allow('b')).toBe(true)
    t = 60_000
    expect(limit.allow('a')).toBe(true)
  })
})

describe('checkBatch (FR-91)', () => {
  it('accepts 1 to 100 good events', () => {
    const one = checkBatch({ events: [testEvent(1_794_000_000_000, 1)] })
    expect(one.ok).toBe(true)
  })

  it('refuses a wrong shape, an empty or too big batch, and any bad event', () => {
    expect(checkBatch(null).ok).toBe(false)
    expect(checkBatch({ events: [] }).ok).toBe(false)
    const many = Array.from({ length: 101 }, (_, i) => testEvent(1_794_000_000_000, i + 1))
    expect(checkBatch({ events: many }).ok).toBe(false)
    const bad = { ...testEvent(1_794_000_000_000, 2), type: 'care.click' }
    expect(checkBatch({ events: [testEvent(1_794_000_000_000, 1), bad] })).toEqual({
      ok: false,
      reason: 'Event 1 is not valid'
    })
  })
})

describe('server config (NFR-38)', () => {
  it('needs a database URL and has defaults for the rest', () => {
    expect(() => readConfig({})).toThrow(/DATABASE_URL/)
    expect(readConfig({ DATABASE_URL: 'mysql://x' })).toMatchObject({
      host: '127.0.0.1',
      port: 3000,
      rateLimitPerMinute: 120,
      bodyLimitBytes: 256 * 1024
    })
    expect(() => readConfig({ DATABASE_URL: 'mysql://x', PORT: 'abc' })).toThrow(/PORT/)
  })
})

describe('splitStatements', () => {
  it('drops comments and splits on semicolons at line ends', () => {
    expect(
      splitStatements('-- note\nCREATE TABLE a (x INT);\n\nCREATE TABLE b (y INT);\n')
    ).toEqual(['CREATE TABLE a (x INT)', 'CREATE TABLE b (y INT)'])
  })
})
