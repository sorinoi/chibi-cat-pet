import { describe, expect, it } from 'vitest'
import { activityStatus, activityTestText } from './activityText'
import { stringsFor } from './strings'

const en = stringsFor('en')
const th = stringsFor('th')
const base = { waiting: 0, dropped: 0, lastSentAt: null }

describe('activityStatus (requirement-v6.md FR-87)', () => {
  it('says what is going on, with the waiting count', () => {
    expect(activityStatus({ ...base, kind: 'off' }, en, 0)).toEqual(['Off'])
    expect(activityStatus({ ...base, kind: 'ready' }, en, 0)).toEqual([
      'Connected, nothing waiting'
    ])
    expect(activityStatus({ ...base, waiting: 3, kind: 'sending' }, en, 0)).toEqual([
      'Sending 3 events…'
    ])
    expect(
      activityStatus(
        { ...base, waiting: 12, kind: 'retrying', retryAt: 90_000, reason: 'offline' },
        en,
        0
      )
    ).toEqual(['12 events waiting: cannot reach the server, trying again in 2 min'])
  })

  it('explains a refusal and dropped events', () => {
    expect(
      activityStatus(
        { ...base, waiting: 2, dropped: 5, kind: 'refused', reason: 'unauthorized', code: 401 },
        en,
        0
      )
    ).toEqual([
      'Stopped: the server did not accept the key · 2 events waiting',
      '5 old events were dropped (limit)'
    ])
    expect(activityStatus({ ...base, kind: 'badUrl' }, th, 0)[0]).toContain('https://')
  })
})

describe('activityTestText', () => {
  it('has a line for every result', () => {
    expect(activityTestText({ ok: true }, en)).toBe('Connected ✓')
    expect(activityTestText({ ok: false, reason: 'server', code: 502 }, en)).toContain('502')
    expect(activityTestText({ ok: false, reason: 'unreachable' }, th)).toBe('ติดต่อ server ไม่ได้')
  })
})
