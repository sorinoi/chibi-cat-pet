import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  parsePersistedState,
  sanitizePosition,
  sanitizeSettings
} from './settings'

describe('sanitizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numbers into range', () => {
    const s = sanitizeSettings({ petSize: 9, opacity: 0, sleepAfterMinutes: -3 })
    expect(s.petSize).toBe(2)
    expect(s.opacity).toBe(0.3)
    expect(s.sleepAfterMinutes).toBe(1)
  })

  it('keeps the base value for wrong types and merges partial updates', () => {
    const base = { ...DEFAULT_SETTINGS, petSize: 1.5 }
    const s = sanitizeSettings({ alwaysOnTop: 'yes', opacity: 0.5 }, base)
    expect(s).toEqual({ ...base, opacity: 0.5 })
  })

  it('rounds minutes and rejects NaN', () => {
    expect(sanitizeSettings({ sleepAfterMinutes: 7.6 }).sleepAfterMinutes).toBe(8)
    expect(sanitizeSettings({ petSize: Number.NaN }).petSize).toBe(DEFAULT_SETTINGS.petSize)
  })
})

describe('sanitizePosition', () => {
  it('accepts finite numbers and rounds them', () => {
    expect(sanitizePosition({ x: 10.4, y: -20.6 })).toEqual({ x: 10, y: -21 })
  })

  it('rejects anything else', () => {
    expect(sanitizePosition({ x: 'a', y: 1 })).toBeNull()
    expect(sanitizePosition({ x: Infinity, y: 1 })).toBeNull()
    expect(sanitizePosition(undefined)).toBeNull()
  })
})

describe('parsePersistedState', () => {
  it('recovers what it can from a damaged file', () => {
    const state = parsePersistedState({ settings: { opacity: 0.8 }, position: 'bad' })
    expect(state).toEqual({
      version: 1,
      settings: { ...DEFAULT_SETTINGS, opacity: 0.8 },
      position: null
    })
  })
})

describe('language setting (FR-42, FR-45)', () => {
  it('accepts only supported languages', () => {
    expect(sanitizeSettings({ language: 'th' }).language).toBe('th')
    expect(sanitizeSettings({ language: 'fr' }).language).toBe(DEFAULT_SETTINGS.language)
    expect(
      sanitizeSettings({ language: 7 }, { ...DEFAULT_SETTINGS, language: 'th' }).language
    ).toBe('th')
  })

  it('a v2 file without a language gets the first-run default and keeps everything else', () => {
    const v2 = { version: 1, settings: { petSize: 0.7, startWithWindows: true }, position: null }
    const state = parsePersistedState(v2, { ...DEFAULT_SETTINGS, language: 'th' })
    expect(state.settings).toEqual({
      ...DEFAULT_SETTINGS,
      petSize: 0.7,
      startWithWindows: true,
      language: 'th'
    })
  })

  it('a saved language wins over the first-run default', () => {
    const saved = { settings: { language: 'en' } }
    expect(
      parsePersistedState(saved, { ...DEFAULT_SETTINGS, language: 'th' }).settings.language
    ).toBe('en')
  })
})

describe('focus timer settings (requirement-v3.md section 4)', () => {
  it('defaults to the classic Pomodoro values', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakEvery: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      focusNotifications: true
    })
  })

  it('clamps to the limits and rounds to whole minutes', () => {
    const s = sanitizeSettings({
      focusMinutes: 500,
      shortBreakMinutes: 0,
      longBreakMinutes: 14.6,
      longBreakEvery: 1,
      autoStartFocus: 'yes'
    })
    expect(s.focusMinutes).toBe(120)
    expect(s.shortBreakMinutes).toBe(1)
    expect(s.longBreakMinutes).toBe(15)
    expect(s.longBreakEvery).toBe(2)
    expect(s.autoStartFocus).toBe(false)
  })

  it('a v2 settings file gets the timer defaults', () => {
    const state = parsePersistedState({ settings: { petSize: 0.7 } })
    expect(state.settings.focusMinutes).toBe(25)
    expect(state.settings.petSize).toBe(0.7)
  })
})

describe('gravity setting (requirement-v5.md FR-64)', () => {
  it('is on by default, also for a v4 settings file', () => {
    expect(DEFAULT_SETTINGS.gravity).toBe(true)
    expect(parsePersistedState({ settings: { petSize: 0.7 } }).settings.gravity).toBe(true)
  })

  it('keeps a saved choice and ignores bad values', () => {
    expect(sanitizeSettings({ gravity: false }).gravity).toBe(false)
    expect(sanitizeSettings({ gravity: 'no' }).gravity).toBe(true)
  })
})

describe('jump and climb setting (requirement-v5.md FR-78)', () => {
  it('is on by default, also for an older settings file', () => {
    expect(DEFAULT_SETTINGS.jumpAndClimb).toBe(true)
    expect(parsePersistedState({ settings: { gravity: true } }).settings.jumpAndClimb).toBe(true)
  })

  it('keeps a saved choice and ignores bad values', () => {
    expect(sanitizeSettings({ jumpAndClimb: false }).jumpAndClimb).toBe(false)
    expect(sanitizeSettings({ jumpAndClimb: 'yes' }).jumpAndClimb).toBe(true)
  })
})

describe('sit on windows setting (requirement-v5.md FR-71)', () => {
  it('is on by default, also for an older settings file', () => {
    expect(DEFAULT_SETTINGS.sitOnWindows).toBe(true)
    expect(parsePersistedState({ settings: { gravity: false } }).settings.sitOnWindows).toBe(true)
  })

  it('keeps a saved choice and ignores bad values', () => {
    expect(sanitizeSettings({ sitOnWindows: false }).sitOnWindows).toBe(false)
    expect(sanitizeSettings({ sitOnWindows: 1 }).sitOnWindows).toBe(true)
  })
})
