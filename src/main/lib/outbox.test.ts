import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityEvent } from '../../shared/activity'
import { testEvent } from './testActivity'
import { createOutbox } from './outbox'

const DAY = 24 * 60 * 60_000
let dir: string
let file: string
let t: number
let n: number

const next = (): ActivityEvent => testEvent(t, ++n)

const box = (maxEvents = 100) =>
  createOutbox({ path: file, maxEvents, maxAgeMs: 30 * DAY, now: () => t })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pet-outbox-'))
  file = join(dir, 'outbox.jsonl')
  t = 1_794_000_000_000
  n = 0
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('outbox (requirement-v6.md FR-89, FR-90)', () => {
  it('keeps events in order on disk and survives a restart', () => {
    const o = box()
    expect(o.count()).toBe(0)
    const a = next()
    const b = next()
    o.append(a)
    o.append(b)
    expect(o.count()).toBe(2)
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(2)
    const again = box()
    expect(again.count()).toBe(2)
    expect(again.peek(10).map((e) => e.id)).toEqual([a.id, b.id])
  })

  it('peeks a batch and removes only what was sent', () => {
    const o = box()
    const events = [next(), next(), next()]
    events.forEach((e) => o.append(e))
    const batch = o.peek(2)
    expect(batch.map((e) => e.id)).toEqual([events[0]?.id, events[1]?.id])
    o.append(next()) // arrives while the batch is on its way
    o.remove(new Set(batch.map((e) => e.id)))
    expect(o.count()).toBe(2)
    expect(o.peek(10)[0]?.id).toBe(events[2]?.id)
  })

  it('drops events older than the limit and the oldest beyond the count limit', () => {
    const o = box(10)
    o.append(next())
    t += 31 * DAY
    for (let i = 0; i < 10; i++) o.append(next())
    // Over 10: trimmed back to 9 at once; the old one went first.
    expect(o.count()).toBe(9)
    expect(o.dropped()).toBe(2)
    t += 31 * DAY
    expect(o.peek(5)).toEqual([])
    expect(o.count()).toBe(0)
  })

  it('skips a damaged line, keeps a copy of the file and goes on', () => {
    const o = box()
    o.append(next())
    appendFileSync(file, '{"half": tr') // a crash in the middle of a write
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const again = box()
    warn.mockRestore()
    expect(again.count()).toBe(1)
    expect(existsSync(`${file}.bad`)).toBe(true)
    again.append(next())
    expect(box().count()).toBe(2)
  })

  it('clear empties it (FR-88)', () => {
    const o = box()
    o.append(next())
    o.clear()
    expect(o.count()).toBe(0)
    expect(existsSync(file)).toBe(false)
    expect(box().count()).toBe(0)
  })
})
