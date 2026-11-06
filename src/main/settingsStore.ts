import { readJson, writeJsonAtomic } from './lib/jsonFile'
import {
  parsePersistedState,
  sanitizePosition,
  sanitizeSettings,
  type PersistedState,
  type Position,
  type Settings
} from '../shared/settings'

export interface SettingsStore {
  readonly settings: Settings
  readonly position: Position | null
  /** Applies a partial update; returns the sanitized result. Listeners run only on change. */
  update(patch: unknown): Settings
  setPosition(position: Position): void
  onChange(listener: (settings: Settings, previous: Settings) => void): void
  /** Writes pending changes now (call before quitting). */
  flush(): void
}

/**
 * FR-14: settings and the last position in one JSON file. No Electron imports, so it is
 * unit tested with a temp directory. Writes are debounced.
 */
export function createSettingsStore(filePath: string, debounceMs: number): SettingsStore {
  let state: PersistedState = parsePersistedState(readJson(filePath))
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  const listeners: Array<(settings: Settings, previous: Settings) => void> = []

  function flush(): void {
    if (timer) clearTimeout(timer)
    timer = null
    if (!dirty) return
    dirty = false
    try {
      writeJsonAtomic(filePath, state)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  function scheduleSave(): void {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  return {
    get settings() {
      return state.settings
    },
    get position() {
      return state.position
    },
    update(patch) {
      const previous = state.settings
      const next = sanitizeSettings(patch, previous)
      const changed = (Object.keys(next) as Array<keyof Settings>).some(
        (key) => next[key] !== previous[key]
      )
      if (!changed) return previous
      state = { ...state, settings: next }
      scheduleSave()
      listeners.forEach((fn) => fn(next, previous))
      return next
    },
    setPosition(position) {
      const clean = sanitizePosition(position)
      if (!clean) return
      if (state.position && state.position.x === clean.x && state.position.y === clean.y) return
      state = { ...state, position: clean }
      scheduleSave()
    },
    onChange(listener) {
      listeners.push(listener)
    },
    flush
  }
}
