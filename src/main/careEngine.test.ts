import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARE } from '../shared/careConfig'
import { createCareEngine, type CareEngine } from './careEngine'

const MIN = 60_000
const HOUR = 60 * MIN

let dir: string
let file: string
let t: number
let engines: CareEngine[]

function engine(): CareEngine {
  const e = createCareEngine({ filePath: file, now: () => t })
  engines.push(e)
  return e
}

const stored = (): { needs: { hunger: number; happiness: number }; updatedAt: number } =>
  JSON.parse(readFileSync(file, 'utf8'))

/** Advance the clock and the fake timers together, one tick interval at a time. */
function run(ms: number): void {
  for (let left = ms; left > 0; left -= CARE.tickIntervalMs) {
    const step = Math.min(CARE.tickIntervalMs, left)
    t += step
    vi.advanceTimersByTime(step)
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pet-care-'))
  file = join(dir, 'pet.json')
  t = 1_700_000_000_000
  engines = []
  vi.useFakeTimers()
})

afterEach(() => {
  engines.forEach((e) => e.dispose())
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('care engine: adoption and restart', () => {
  it('has no pet until one is adopted', () => {
    const e = engine()
    expect(e.load()).toBe('missing')
    expect(e.current()).toBeNull()
  })

  it('adopts at 80 / 80 and writes pet.json', () => {
    const e = engine()
    e.load()
    const s = e.adopt('มะลิ')
    expect(s).toMatchObject({ name: 'มะลิ', needs: { hunger: 80, happiness: 80 }, mood: 'happy' })
    expect(stored().needs).toEqual({ hunger: 80, happiness: 80 })
  })

  it('applies the offline rate for the time the app was closed', () => {
    const first = engine()
    first.load()
    first.adopt('Mochi')
    first.dispose()

    t += 2 * HOUR // app closed for 2 h: hunger -10 * 2 * 0.25 = -5
    const second = engine()
    expect(second.load()).toBe('ok')
    expect(second.current()?.needs.hunger).toBeCloseTo(75)
    expect(stored().updatedAt).toBe(t)
  })

  it('never comes back below the floor after a long break', () => {
    const first = engine()
    first.load()
    first.adopt('Mochi')
    t += 60 * 24 * HOUR
    const second = engine()
    second.load()
    expect(second.current()?.needs).toEqual({ hunger: 30, happiness: 30 })
  })
})

describe('care engine: running', () => {
  it('drops needs at the awake rate and saves every tick', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.start()
    run(1 * HOUR)
    expect(e.current()?.needs.hunger).toBeCloseTo(70)
    expect(stored().needs.hunger).toBeCloseTo(70)
  })

  it('uses the sleep rate while the user is away', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.start()
    e.setAsleep(true)
    run(2 * HOUR)
    expect(e.current()?.needs.hunger).toBeCloseTo(70)
  })

  it('counts a long gap between ticks (PC asleep) at the offline rate', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.start()
    t += 4 * HOUR // no ticks ran: the machine was suspended
    run(CARE.tickIntervalMs)
    // The whole gap, including the minute up to this tick, counts at the offline rate.
    expect(e.current()?.needs.hunger).toBeCloseTo(80 - 10 * 0.25 * (4 + 1 / 60))
  })

  it('ignores the clock moving backwards', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.start()
    t -= 3 * HOUR
    vi.advanceTimersByTime(CARE.tickIntervalMs)
    expect(e.current()?.needs).toEqual({ hunger: 80, happiness: 80 })
    run(1 * HOUR)
    expect(e.current()?.needs.hunger).toBeCloseTo(70)
  })

  it('tells listeners about every update', () => {
    const e = engine()
    e.load()
    const seen: Array<string | null> = []
    e.onChange((s) => seen.push(s ? s.mood : null))
    e.adopt('Mochi')
    e.start()
    run(2 * CARE.tickIntervalMs)
    // 80 / 80 is happy; one minute later hunger is just below 80, so the mood is content.
    expect(seen).toEqual(['happy', 'content', 'content'])
  })
})

describe('care engine: actions', () => {
  it('feeds, refuses when full, and persists counters', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    expect(e.feed()).toEqual({ refused: false }) // 80 -> 100
    expect(e.feed()).toEqual({ refused: true })
    e.flush()
    const s = JSON.parse(readFileSync(file, 'utf8'))
    expect(s.needs.hunger).toBe(100)
    expect(s.counters.feeds).toBe(1)
  })

  it('applies the petting and click cooldowns', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    expect(e.pet()).toEqual({ counted: true })
    t += 10_000
    expect(e.pet()).toEqual({ counted: false })
    expect(e.click()).toEqual({ counted: true })
    t += CARE.petCooldownMs
    expect(e.pet()).toEqual({ counted: true })
    expect(e.current()?.counters.pets).toBe(2)
  })

  it('does nothing without a pet', () => {
    const e = engine()
    e.load()
    expect(e.feed()).toBeNull()
    expect(e.pet()).toBeNull()
  })
})

describe('care engine: damaged data and wiping', () => {
  it('moves a damaged pet.json aside instead of crashing', () => {
    writeFileSync(file, '{ "version": 1, "name": ', 'utf8')
    const e = engine()
    expect(e.load()).toBe('damaged')
    expect(e.current()).toBeNull()
    expect(existsSync(file)).toBe(false)
    expect(existsSync(`${file}.bad`)).toBe(true)
  })

  it('wipes the pet and its file immediately', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    const seen: Array<unknown> = []
    e.onChange((s) => seen.push(s))
    e.wipe()
    expect(existsSync(file)).toBe(false)
    expect(e.current()).toBeNull()
    expect(seen).toEqual([null])
    const again = engine()
    expect(again.load()).toBe('missing')
  })
})

describe('care engine: rename', () => {
  it('renames and saves, keeping the needs', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    expect(e.rename('  ส้มจี๊ด  ')?.name).toBe('ส้มจี๊ด')
    expect(JSON.parse(readFileSync(file, 'utf8')).name).toBe('ส้มจี๊ด')
    expect(e.current()?.needs).toEqual({ hunger: 80, happiness: 80 })
  })

  it('rejects a bad name and does nothing without a pet', () => {
    const e = engine()
    e.load()
    expect(e.rename('Mochi')).toBeNull()
    e.adopt('Mochi')
    expect(e.rename('   ')).toBeNull()
    expect(e.current()?.name).toBe('Mochi')
  })
})

describe('care engine: treats (requirement-v4.md FR-51..53)', () => {
  it('earns up to the stock limit, gives one at a time, and saves the stock', () => {
    const e = engine()
    e.load()
    expect(e.earnTreats(1)).toBeNull() // no cat yet
    e.adopt('Mochi')
    expect(e.giveTreat()).toBeNull() // no treat yet
    for (let i = 0; i < 7; i++) e.earnTreats(1)
    expect(e.current()?.treats).toBe(5)
    expect(e.earnTreats(1)).toBe(0)
    const before = e.current()?.needs
    expect(e.giveTreat()).toEqual({ full: false })
    expect(e.current()?.treats).toBe(4)
    expect(e.current()?.needs.hunger).toBeCloseTo((before?.hunger ?? 0) + 10, 5)
    vi.advanceTimersByTime(CARE.saveDebounceMs)
    expect(JSON.parse(readFileSync(file, 'utf8')).treats).toBe(4)
  })

  it('a full cat still enjoys a treat', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.earnTreats(1)
    e.feed() // 80 -> 100
    expect(e.giveTreat()).toEqual({ full: true })
  })

  it('adopting a new cat starts without treats (FR-53)', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    e.earnTreats(3)
    e.wipe()
    e.adopt('Tama')
    expect(e.current()?.treats).toBe(0)
  })
})

describe('care engine: activity (requirement-v6.md FR-80, FR-82)', () => {
  it('reports every care action with the pet right after it; clicks are not reported', () => {
    const e = engine()
    e.load()
    const seen: Array<[string, unknown, string, number]> = []
    e.onActivity((item, pet) => seen.push([item.type, item.data, pet.name, pet.needs.hunger]))
    const mochi = e.adopt('Mochi')
    e.feed() // 80 -> 100
    e.feed() // refused
    e.pet()
    e.pet() // within the cooldown: not counted, still reported
    e.click()
    e.earnTreats(2)
    e.giveTreat()
    e.rename('Mochi') // same name: nothing to report
    e.rename('Tama')
    e.wipe()
    expect(seen.map(([type, data]) => [type, data])).toEqual([
      ['pet.adopted', {}],
      ['care.feed', { refused: false }],
      ['care.feed', { refused: true }],
      ['care.pet', { counted: true }],
      ['care.pet', { counted: false }],
      ['treat.earned', { count: 2 }],
      ['care.treat', { full: true }],
      ['pet.renamed', { from: 'Mochi' }],
      ['pet.replaced', {}]
    ])
    expect(seen[1]?.[3]).toBe(100)
    expect(seen.at(-1)?.[2]).toBe('Tama')
    expect(mochi.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps the pet id across restarts and gives an old pet.json one', () => {
    const e = engine()
    e.load()
    const id = e.adopt('Mochi').id
    e.flush()
    const again = engine()
    again.load()
    expect(again.current()?.id).toBe(id)

    const old: Record<string, unknown> = JSON.parse(readFileSync(file, 'utf8'))
    delete old['id']
    writeFileSync(file, JSON.stringify(old))
    const upgraded = engine()
    upgraded.load()
    const newId = upgraded.current()?.id
    expect(newId).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.parse(readFileSync(file, 'utf8')).id).toBe(newId) // saved at load
  })

  it('a failing listener does not break care', () => {
    const e = engine()
    e.load()
    e.adopt('Mochi')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    e.onActivity(() => {
      throw new Error('boom')
    })
    expect(e.feed()).toEqual({ refused: false })
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('care engine: look (requirement-v7.md FR-103, FR-107)', () => {
  it('sets the look, saves it, and leaves everything else alone', () => {
    const e = engine()
    e.load()
    expect(e.setLook('gray')).toBe(false) // no cat yet
    const before = e.adopt('Mochi')
    expect(before.look).toBeNull()
    expect(e.setLook('gray')).toBe(true)
    expect(e.current()).toEqual({ ...before, look: 'gray' })
    expect(JSON.parse(readFileSync(file, 'utf8')).look).toBe('gray')
    const again = engine()
    again.load()
    expect(again.current()?.look).toBe('gray')
  })

  it('adopts with a look; a new adoption starts with the look it is given (FR-103, FR-106)', () => {
    const e = engine()
    e.load()
    expect(e.adopt('Mochi', 'gray').look).toBe('gray')
    e.wipe()
    expect(e.adopt('Tama').look).toBeNull()
  })
})
