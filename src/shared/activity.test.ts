import { describe, expect, it } from 'vitest'
import { checkServerUrl, parseActivityEvent, type ActivityEvent } from './activity'

const ID = '0b6f6c4e-8a1d-4c2b-9f3e-2d7a5c1b4e6f'
const DEVICE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const PET = '11111111-2222-4333-8444-555555555555'

function event(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: ID,
    type: 'care.feed',
    at: 1_794_000_000_000,
    tz: 420,
    device: DEVICE,
    app: '6.0.0',
    pet: {
      id: PET,
      name: 'sOrinOi',
      adoptedAt: 1_793_000_000_000,
      hunger: 72.5,
      happiness: 80,
      mood: 'content'
    },
    data: { refused: false },
    ...over
  }
}

describe('parseActivityEvent (requirement-v6.md FR-81, FR-91)', () => {
  it('accepts a good event and keeps only known fields', () => {
    const parsed = parseActivityEvent({ ...event(), extra: 'x' })
    expect(parsed).toEqual(event())
  })

  it('accepts every event type with its own fields', () => {
    const cases: Array<[ActivityEvent['type'], unknown]> = [
      ['pet.adopted', {}],
      ['pet.renamed', { from: 'Mochi' }],
      ['pet.replaced', {}],
      ['care.pet', { counted: true }],
      ['care.treat', { full: false }],
      ['treat.earned', { count: 1 }],
      ['focus.started', { phase: 'focus', minutes: 25 }],
      ['focus.paused', { phase: 'shortBreak' }],
      ['focus.resumed', { phase: 'longBreak' }],
      ['focus.skipped', { phase: 'focus' }],
      ['focus.stopped', { phase: null }],
      ['focus.phaseEnded', { phase: 'focus', completed: true }]
    ]
    for (const [type, data] of cases) {
      expect(parseActivityEvent(event({ type, data })), type).not.toBeNull()
    }
  })

  it('refuses wrong or extra data, wrong ids and out-of-range values', () => {
    expect(parseActivityEvent(event({ data: { refused: 'no' } }))).toBeNull()
    expect(parseActivityEvent(event({ data: { refused: false, more: 1 } }))).toBeNull()
    expect(parseActivityEvent(event({ type: 'care.click' }))).toBeNull()
    expect(parseActivityEvent(event({ id: 'not-a-uuid' }))).toBeNull()
    expect(parseActivityEvent(event({ v: 2 }))).toBeNull()
    expect(parseActivityEvent(event({ tz: 15 * 60 }))).toBeNull()
    expect(parseActivityEvent(event({ at: 1.5 }))).toBeNull()
    const pet = event().pet as Record<string, unknown>
    expect(parseActivityEvent(event({ pet: { ...pet, hunger: 101 } }))).toBeNull()
    expect(parseActivityEvent(event({ pet: { ...pet, name: '' } }))).toBeNull()
    expect(parseActivityEvent(event({ pet: { ...pet, mood: 'angry' } }))).toBeNull()
    expect(
      parseActivityEvent(event({ type: 'focus.started', data: { phase: 'nap', minutes: 5 } }))
    ).toBeNull()
    expect(parseActivityEvent('{}')).toBeNull()
  })
})

describe('checkServerUrl (requirement-v6.md section 7)', () => {
  it('accepts https anywhere and trims the trailing slash', () => {
    expect(checkServerUrl(' https://pet.example.com/ ')).toEqual({
      ok: true,
      url: 'https://pet.example.com'
    })
    expect(checkServerUrl('https://example.com/pets/?x=1#y')).toEqual({
      ok: true,
      url: 'https://example.com/pets'
    })
  })

  it('accepts http only for localhost and private LAN addresses', () => {
    for (const url of [
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://[::1]:3000',
      'http://192.168.1.20',
      'http://10.0.0.5',
      'http://172.20.1.1'
    ]) {
      expect(checkServerUrl(url).ok, url).toBe(true)
    }
    expect(checkServerUrl('http://pet.example.com')).toEqual({ ok: false, reason: 'notHttps' })
    expect(checkServerUrl('http://172.32.0.1')).toEqual({ ok: false, reason: 'notHttps' })
    expect(checkServerUrl('http://8.8.8.8')).toEqual({ ok: false, reason: 'notHttps' })
  })

  it('refuses empty, broken, other schemes and URLs with credentials', () => {
    expect(checkServerUrl('  ')).toEqual({ ok: false, reason: 'empty' })
    expect(checkServerUrl('pet.example.com')).toEqual({ ok: false, reason: 'invalid' })
    expect(checkServerUrl('ftp://example.com')).toEqual({ ok: false, reason: 'invalid' })
    expect(checkServerUrl('https://user:pw@example.com')).toEqual({ ok: false, reason: 'invalid' })
  })
})
