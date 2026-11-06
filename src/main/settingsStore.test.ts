import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { createSettingsStore } from './settingsStore'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pet-settings-'))
  file = join(dir, 'nested', 'settings.json')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

const readFile = (): unknown => JSON.parse(readFileSync(file, 'utf8'))

describe('createSettingsStore', () => {
  it('starts with defaults when there is no file and does not write until something changes', () => {
    const store = createSettingsStore(file, 100)
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
    expect(store.position).toBeNull()
    store.flush()
    expect(existsSync(file)).toBe(false)
  })

  it('debounces writes and persists settings and position', () => {
    const store = createSettingsStore(file, 100)
    store.update({ opacity: 0.5 })
    store.setPosition({ x: 100, y: 200 })
    expect(existsSync(file)).toBe(false)
    vi.advanceTimersByTime(100)
    expect(readFile()).toEqual({
      version: 1,
      settings: { ...DEFAULT_SETTINGS, opacity: 0.5 },
      position: { x: 100, y: 200 }
    })
  })

  it('reloads what was saved', () => {
    const first = createSettingsStore(file, 100)
    first.update({ petSize: 1.5, startWithWindows: true })
    first.setPosition({ x: -50, y: 30 })
    first.flush()
    const second = createSettingsStore(file, 100)
    expect(second.settings.petSize).toBe(1.5)
    expect(second.settings.startWithWindows).toBe(true)
    expect(second.position).toEqual({ x: -50, y: 30 })
  })

  it('survives a corrupt file', () => {
    createSettingsStore(file, 100).flush()
    writeFileSync(join(dir, 'broken.json'), '{ not json', 'utf8')
    const store = createSettingsStore(join(dir, 'broken.json'), 100)
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('notifies listeners only on a real change, with the previous value', () => {
    const store = createSettingsStore(file, 100)
    const listener = vi.fn()
    store.onChange(listener)
    store.update({ opacity: DEFAULT_SETTINGS.opacity })
    expect(listener).not.toHaveBeenCalled()
    store.update({ alwaysOnTop: false })
    expect(listener).toHaveBeenCalledWith(
      { ...DEFAULT_SETTINGS, alwaysOnTop: false },
      DEFAULT_SETTINGS
    )
  })

  it('sanitizes updates', () => {
    const store = createSettingsStore(file, 100)
    expect(store.update({ petSize: 50, bogus: 1 }).petSize).toBe(2)
    expect(store.settings).not.toHaveProperty('bogus')
  })
})
