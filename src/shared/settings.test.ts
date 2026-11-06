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
