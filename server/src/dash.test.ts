import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { hashPassword, readCookie, sessionCookie, verifyPassword } from './auth.ts'
import type { PetSummary } from './dashTypes.ts'
import {
  buildOverview,
  dayKey,
  dayStart,
  focusStreak,
  lastDays,
  thinNeeds,
  weekStart,
  type StatRow
} from './stats.ts'
import { addSecurityHeaders, serveDashboard } from './staticFiles.ts'

const TZ = 'Asia/Bangkok'
const HOUR = 60 * 60_000
const DAY = 24 * HOUR
// 2026-11-08 12:00 in Bangkok.
const NOW = Date.UTC(2026, 10, 8, 5, 0, 0)

describe('days in the server time zone (FR-98)', () => {
  it('counts days in Bangkok, not UTC', () => {
    expect(dayKey(Date.UTC(2026, 10, 7, 17, 30), TZ)).toBe('2026-11-08') // 00:30 Bangkok
    expect(dayKey(Date.UTC(2026, 10, 7, 16, 30), TZ)).toBe('2026-11-07') // 23:30 Bangkok
    expect(dayStart('2026-11-08', TZ)).toBe(Date.UTC(2026, 10, 7, 17, 0))
    expect(dayStart('2026-11-08', 'UTC')).toBe(Date.UTC(2026, 10, 8))
  })

  it('lists the last days and finds the Monday of a week', () => {
    expect(lastDays(NOW, TZ, 3)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // a Sunday -> Monday before
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
  })

  it('counts a focus streak up to today, or yesterday when today has none yet', () => {
    expect(focusStreak(new Set(['2026-11-06', '2026-11-07', '2026-11-08']), NOW, TZ)).toBe(3)
    expect(focusStreak(new Set(['2026-11-06', '2026-11-07']), NOW, TZ)).toBe(2)
    expect(focusStreak(new Set(['2026-11-05', '2026-11-07']), NOW, TZ)).toBe(1)
    expect(focusStreak(new Set(), NOW, TZ)).toBe(0)
  })
})

const pet: PetSummary = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Mochi',
  adoptedAt: NOW - 20 * DAY,
  replacedAt: null,
  lastEventAt: NOW
}
const row = (at: number, type: string, data: Record<string, unknown> = {}, need = 80): StatRow => ({
  type,
  at,
  hunger: need,
  happiness: need,
  mood: 'content',
  data
})

describe('buildOverview (FR-96)', () => {
  it('counts care and completed focus per day, skips refused feeds, keeps the last needs', () => {
    const rows = [
      row(NOW - 2 * DAY, 'care.feed', { refused: false }),
      row(NOW - 2 * DAY + HOUR, 'care.feed', { refused: true }),
      row(NOW - DAY, 'care.pet', { counted: true }),
      row(NOW - DAY + HOUR, 'care.pet', { counted: false }),
      row(NOW - DAY + 2 * HOUR, 'focus.phaseEnded', { phase: 'focus', completed: true }),
      row(NOW - DAY + 3 * HOUR, 'focus.phaseEnded', { phase: 'focus', completed: false }),
      row(NOW - DAY + 4 * HOUR, 'focus.phaseEnded', { phase: 'shortBreak', completed: true }),
      row(NOW - HOUR, 'care.treat', { full: false }, 95)
    ]
    const o = buildOverview({
      pet,
      rows,
      focusHistory: new Set(['2026-11-07']),
      days: 7,
      now: NOW,
      timeZone: TZ
    })
    expect(o.dayKeys).toHaveLength(7)
    expect(o.dayKeys.at(-1)).toBe('2026-11-08')
    expect(o.totals).toEqual({ feed: 1, pet: 2, treat: 1, focus: 1 })
    expect(o.care.find((c) => c.date === '2026-11-06')).toEqual({
      date: '2026-11-06',
      feed: 1,
      pet: 0,
      treat: 0
    })
    expect(o.focusDays.find((d) => d.date === '2026-11-07')?.count).toBe(1)
    expect(o.focusWeeks).toHaveLength(8)
    expect(o.focusWeeks.at(-1)).toEqual({ date: '2026-11-02', count: 1 })
    expect(o.last).toMatchObject({ hunger: 95, mood: 'content' })
    expect(o.streak).toBe(1)
    expect(o.to - o.from).toBe(7 * DAY)
  })

  it('leaves events before the range out of the day counts', () => {
    const o = buildOverview({
      pet,
      rows: [row(NOW - 10 * DAY, 'care.feed', { refused: false })],
      focusHistory: new Set(),
      days: 7,
      now: NOW,
      timeZone: TZ
    })
    expect(o.totals.feed).toBe(0)
    expect(o.needs).toEqual([])
  })

  it('thins a busy needs line to at most 240 points, ending with the newest', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => row(NOW - DAY + i * 30_000, 'care.pet'))
    const points = thinNeeds(rows, NOW - DAY, NOW)
    expect(points.length).toBeLessThanOrEqual(240)
    expect(points.at(-1)?.at).toBe(rows.at(-1)?.at)
  })
})

describe('passwords and cookies (FR-95)', () => {
  it('hashes with scrypt and checks', async () => {
    const hash = await hashPassword('correct horse')
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword('correct horse', hash)).toBe(true)
    expect(await verifyPassword('wrong horse', hash)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })

  it('reads one cookie and writes a strict session cookie', () => {
    expect(readCookie('a=1; dp_session=abc%3D; b=2', 'dp_session')).toBe('abc=')
    expect(readCookie(undefined, 'dp_session')).toBeNull()
    expect(sessionCookie('tok', 60, true)).toBe(
      'dp_session=tok; Path=/; HttpOnly; SameSite=Strict; Max-Age=60; Secure'
    )
    expect(sessionCookie('tok', 60, false)).not.toContain('Secure')
  })
})

describe('dashboard files and security headers (NFR-35)', () => {
  it('serves files, falls back to index.html, never leaves the folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pet-web-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<p>index</p>')
    writeFileSync(join(dir, 'assets', 'a.js'), 'console.log(1)')
    writeFileSync(join(tmpdir(), 'pet-secret.txt'), 'secret')
    const app = Fastify()
    addSecurityHeaders(app)
    serveDashboard(app, dir)
    try {
      const js = await app.inject({ url: '/assets/a.js' })
      expect(js.headers['content-type']).toContain('text/javascript')
      expect(js.headers['cache-control']).toContain('immutable')
      const page = await app.inject({ url: '/events' })
      expect(page.body).toBe('<p>index</p>')
      expect(page.headers['content-security-policy']).toContain("default-src 'self'")
      expect(page.headers['x-frame-options']).toBe('DENY')
      const escape = await app.inject({ url: '/..%2Fpet-secret.txt' })
      expect(escape.body).toBe('<p>index</p>')
      const api = await app.inject({ url: '/api/v1/nothing' })
      expect(api.statusCode).toBe(404)
    } finally {
      await app.close()
      rmSync(dir, { recursive: true, force: true })
      rmSync(join(tmpdir(), 'pet-secret.txt'), { force: true })
    }
  })
})
