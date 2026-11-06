import { describe, expect, it } from 'vitest'
import { shouldShowHungerNotice, type HungerNoticeInput } from './hungerNotice'

const HOUR = 3_600_000
const base: HungerNoticeInput = {
  enabled: true,
  hunger: 15,
  lastShownAt: null,
  userBusy: false,
  now: 10 * HOUR
}
const show = (p: Partial<HungerNoticeInput>): boolean => shouldShowHungerNotice({ ...base, ...p })

describe('hungry notification (FR-46, FR-47)', () => {
  it('shows when the setting is on and hunger is below 20', () => {
    expect(show({})).toBe(true)
    expect(show({ hunger: 19.9 })).toBe(true)
    expect(show({ hunger: 20 })).toBe(false)
  })

  it('is off by setting and needs a cat', () => {
    expect(show({ enabled: false })).toBe(false)
    expect(show({ hunger: null })).toBe(false)
  })

  it('at most once every 4 hours', () => {
    expect(show({ lastShownAt: 10 * HOUR - 3 * HOUR })).toBe(false)
    expect(show({ lastShownAt: 10 * HOUR - 4 * HOUR })).toBe(true)
    // Clock moved backwards past the last notice: allowed again.
    expect(show({ lastShownAt: 11 * HOUR })).toBe(true)
  })

  it('waits while the user is away or a fullscreen app is in front', () => {
    expect(show({ userBusy: true })).toBe(false)
  })
})
