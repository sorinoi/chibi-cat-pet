import { FOCUS } from './focusConfig'
import type { FocusSettings } from './focusTimer'
import { isLanguage, type Language } from './strings'

/**
 * User settings (requirement.md section 8; requirement-v3.md FR-39 focus timer, FR-42 language).
 * Shared by main and the settings UI.
 */
export interface Settings extends FocusSettings {
  /** Pet scale; the window grows with it. FR-11. */
  petSize: number
  /** Window opacity, 0..1. FR-11. */
  opacity: number
  /** FR-11. */
  alwaysOnTop: boolean
  /** FR-12. */
  startWithWindows: boolean
  /** Minutes without user input before the pet sleeps. FR-07. */
  sleepAfterMinutes: number
  /** UI language. FR-42. */
  language: Language
  /** Windows notification at each focus phase end. FR-37. */
  focusNotifications: boolean
  /** Optional notification when the cat is hungry (requirement-v4.md FR-47). Off by default. */
  hungerReminder: boolean
  /** Earn treats by completing focus sessions (requirement-v4.md FR-51). Off by default. */
  focusTreats: boolean
  /** A dropped cat falls to the floor (requirement-v5.md FR-64). On by default. */
  gravity: boolean
  /** A falling cat may land on other windows (FR-71); only while gravity is on. On by default. */
  sitOnWindows: boolean
}

export const SETTINGS_LIMITS = {
  petSize: { min: 0.5, max: 2, step: 0.1 },
  opacity: { min: 0.3, max: 1, step: 0.05 },
  sleepAfterMinutes: { min: 1, max: 120, step: 1 },
  ...FOCUS.limits
} as const

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  petSize: 1,
  opacity: 1,
  alwaysOnTop: true,
  startWithWindows: false,
  sleepAfterMinutes: 5,
  /** Main replaces this with the system language on first run (FR-42). */
  language: 'en',
  ...FOCUS.defaults,
  hungerReminder: false,
  focusTreats: false,
  gravity: true,
  sitOnWindows: true
}

export interface Position {
  x: number
  y: number
}

/** Everything persisted to disk (FR-14). */
export interface PersistedState {
  version: 1
  settings: Settings
  /** Last pet window position in DIP (FR-04); null until the pet has moved. */
  position: Position | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNumber(
  value: unknown,
  limits: { min: number; max: number },
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, limits.min), limits.max)
}

const wholeNumber = (
  value: unknown,
  limits: { min: number; max: number },
  fallback: number
): number => Math.round(clampNumber(value, limits, fallback))

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

/** Merges `raw` over `base`, clamping numbers and ignoring unknown or bad fields. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = isRecord(raw) ? raw : {}
  return {
    petSize: clampNumber(r['petSize'], SETTINGS_LIMITS.petSize, base.petSize),
    opacity: clampNumber(r['opacity'], SETTINGS_LIMITS.opacity, base.opacity),
    alwaysOnTop: bool(r['alwaysOnTop'], base.alwaysOnTop),
    startWithWindows: bool(r['startWithWindows'], base.startWithWindows),
    sleepAfterMinutes: Math.round(
      clampNumber(r['sleepAfterMinutes'], SETTINGS_LIMITS.sleepAfterMinutes, base.sleepAfterMinutes)
    ),
    language: isLanguage(r['language']) ? r['language'] : base.language,
    focusMinutes: wholeNumber(r['focusMinutes'], SETTINGS_LIMITS.focusMinutes, base.focusMinutes),
    shortBreakMinutes: wholeNumber(
      r['shortBreakMinutes'],
      SETTINGS_LIMITS.shortBreakMinutes,
      base.shortBreakMinutes
    ),
    longBreakMinutes: wholeNumber(
      r['longBreakMinutes'],
      SETTINGS_LIMITS.longBreakMinutes,
      base.longBreakMinutes
    ),
    longBreakEvery: wholeNumber(
      r['longBreakEvery'],
      SETTINGS_LIMITS.longBreakEvery,
      base.longBreakEvery
    ),
    autoStartBreaks: bool(r['autoStartBreaks'], base.autoStartBreaks),
    autoStartFocus: bool(r['autoStartFocus'], base.autoStartFocus),
    focusNotifications: bool(r['focusNotifications'], base.focusNotifications),
    hungerReminder: bool(r['hungerReminder'], base.hungerReminder),
    focusTreats: bool(r['focusTreats'], base.focusTreats),
    gravity: bool(r['gravity'], base.gravity),
    sitOnWindows: bool(r['sitOnWindows'], base.sitOnWindows)
  }
}

export function sanitizePosition(raw: unknown): Position | null {
  if (!isRecord(raw)) return null
  const { x, y } = raw
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: Math.round(x), y: Math.round(y) }
}

/**
 * Reads a stored file's content. Anything unusable falls back to `defaults` field by field
 * (so a v2 file without a language gets the default language: FR-45).
 */
export function parsePersistedState(
  raw: unknown,
  defaults: Settings = DEFAULT_SETTINGS
): PersistedState {
  const r = isRecord(raw) ? raw : {}
  return {
    version: 1,
    settings: sanitizeSettings(r['settings'], defaults),
    position: sanitizePosition(r['position'])
  }
}
