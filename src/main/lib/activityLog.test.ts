import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createActivityLog, readOrCreateDeviceId, utcOffsetMinutes } from './activityLog'
import { createOutbox, type Outbox } from './outbox'

const DEVICE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const EVENT_ID = '0b6f6c4e-8a1d-4c2b-9f3e-2d7a5c1b4e6f'
const pet = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Mochi',
  adoptedAt: 1_793_000_000_000,
  needs: { hunger: 79.99987, happiness: 100 },
  mood: 'happy' as const
}

let dir: string
let outbox: Outbox
let on: boolean
let kicks: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pet-activity-'))
  outbox = createOutbox({ path: join(dir, 'outbox.jsonl'), maxEvents: 100, maxAgeMs: 1e12 })
  on = true
  kicks = 0
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const log = () =>
  createActivityLog({
    outbox,
    enabled: () => on,
    onRecorded: () => kicks++,
    device: DEVICE,
    app: '6.0.0',
    now: () => 1_794_000_000_000,
    newId: () => EVENT_ID
  })

describe('activity log (requirement-v6.md FR-81, FR-83)', () => {
  it('builds a full event, puts it in the outbox and kicks the sender', () => {
    log().record({ type: 'care.feed', data: { refused: false } }, pet)
    expect(kicks).toBe(1)
    expect(outbox.peek(1)).toEqual([
      {
        v: 1,
        id: EVENT_ID,
        type: 'care.feed',
        at: 1_794_000_000_000,
        tz: utcOffsetMinutes(1_794_000_000_000),
        device: DEVICE,
        app: '6.0.0',
        pet: {
          id: pet.id,
          name: 'Mochi',
          adoptedAt: pet.adoptedAt,
          hunger: 80,
          happiness: 100,
          mood: 'happy'
        },
        data: { refused: false }
      }
    ])
  })

  it('records nothing while the switch is off', () => {
    on = false
    log().record({ type: 'care.pet', data: { counted: true } }, pet)
    expect(outbox.count()).toBe(0)
    expect(kicks).toBe(0)
  })

  it('never stores an event that fails the shared check', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    log().record({ type: 'care.pet', data: { counted: true } }, { ...pet, id: 'not-a-uuid' })
    warn.mockRestore()
    expect(outbox.count()).toBe(0)
  })
})

describe('device id (FR-82)', () => {
  it('is made once and then read back', () => {
    const file = join(dir, 'device.json')
    expect(readOrCreateDeviceId(file, () => DEVICE)).toBe(DEVICE)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ version: 1, id: DEVICE })
    expect(readOrCreateDeviceId(file, () => 'other')).toBe(DEVICE)
    writeFileSync(file, 'garbage')
    expect(readOrCreateDeviceId(file, () => EVENT_ID)).toBe(EVENT_ID)
  })
})
