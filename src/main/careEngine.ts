import { CARE, type CareConfig } from '../shared/careConfig'
import {
  advanceNeeds,
  click,
  earnTreats,
  feed,
  moodOf,
  pet,
  runningMode,
  treat,
  type Mood,
  type Needs
} from '../shared/needs'
import { createPet, sanitizeName, type PetRecord } from '../shared/petRecord'
import { deletePetFile, readPetFile, writePetFile, type PetFileResult } from './petStore'

export interface CareSnapshot {
  name: string
  needs: Needs
  mood: Mood
  adoptedAt: number
  counters: PetRecord['counters']
  /** Treats in stock (requirement-v4.md FR-51..53). */
  treats: number
}

export interface CareEngine {
  /** Reads pet.json and applies the offline time since it was last saved. */
  load(): PetFileResult['status']
  /** Starts the periodic update (every CARE.tickIntervalMs). */
  start(): void
  /** null until a pet is adopted. */
  current(): CareSnapshot | null
  /** While true, needs drop at the sleep rate (the user is away, FR-07). */
  setAsleep(asleep: boolean): void
  /** FR-22/23. Replaces nothing: call wipe() first to re-adopt. */
  adopt(name: string): CareSnapshot
  /** FR-24: returns the new snapshot, or null when the name is not usable or there is no pet. */
  rename(name: string): CareSnapshot | null
  /** FR-25/32: deletes the pet and its file now. */
  wipe(): void
  /** FR-17. */
  feed(): { refused: boolean } | null
  /** FR-18/19. */
  pet(): { counted: boolean } | null
  /** FR-20. */
  click(): { counted: boolean } | null
  /** FR-51: adds earned treats (capped); null when there is no cat. Returns how many were added. */
  earnTreats(count: number): number | null
  /** FR-52: gives one treat; null when there is no cat or no treat. */
  giveTreat(): { full: boolean } | null
  onChange(listener: (snapshot: CareSnapshot | null) => void): void
  /** Bring needs up to date and write pending changes (call before quitting). */
  flush(): void
  dispose(): void
}

export interface CareEngineOptions {
  filePath: string
  now?: () => number
  config?: CareConfig
}

/**
 * Owns the adopted pet (requirement-v2.md sections 4, 11). No Electron imports, so it is
 * unit tested with a temp folder and a fake clock. Needs are computed from elapsed time;
 * the timer only refreshes and saves them (NFR-11).
 */
export function createCareEngine({
  filePath,
  now = () => Date.now(),
  config = CARE
}: CareEngineOptions): CareEngine {
  let record: PetRecord | null = null
  let asleep = false
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let lastPetAt: number | null = null
  let lastClickAt: number | null = null
  const listeners: Array<(snapshot: CareSnapshot | null) => void> = []

  function snapshot(): CareSnapshot | null {
    if (!record) return null
    return {
      name: record.name,
      needs: { ...record.needs },
      mood: moodOf(record.needs, config),
      adoptedAt: record.adoptedAt,
      counters: { ...record.counters },
      treats: record.treats
    }
  }

  const emit = (): void => {
    const s = snapshot()
    listeners.forEach((fn) => fn(s))
  }

  function save(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    if (!record) return
    try {
      writePetFile(filePath, record)
    } catch (err) {
      console.error('Failed to save pet:', err)
    }
  }

  function saveSoon(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, config.saveDebounceMs)
  }

  /** Advance needs to `t` using the mode for the gap since the last update. */
  function catchUp(t: number, forceMode?: 'offline'): void {
    if (!record) return
    const elapsed = t - record.updatedAt
    const mode = forceMode ?? runningMode(elapsed, asleep, config)
    record = { ...record, needs: advanceNeeds(record.needs, elapsed, mode, config), updatedAt: t }
  }

  function tick(): void {
    if (!record) return
    catchUp(now())
    save()
    emit()
  }

  return {
    load() {
      const result = readPetFile(filePath)
      if (result.status === 'ok') {
        record = result.record
        // Everything since the last save happened while the app was closed.
        catchUp(now(), 'offline')
        save()
      } else {
        record = null
        if (result.status === 'damaged')
          console.warn(`pet.json was damaged; moved to ${result.movedTo}`)
      }
      return result.status
    },

    start() {
      if (tickTimer) return
      tickTimer = setInterval(tick, config.tickIntervalMs)
    },

    current: snapshot,

    setAsleep(next) {
      if (next === asleep) return
      // Bank the time so far at the old rate before switching.
      catchUp(now())
      asleep = next
      saveSoon()
    },

    adopt(name) {
      record = createPet(name, now(), config)
      lastPetAt = null
      lastClickAt = null
      save()
      emit()
      const s = snapshot()
      if (!s) throw new Error('Adoption failed')
      return s
    },

    rename(name) {
      const clean = sanitizeName(name, config)
      if (!record || !clean) return null
      record = { ...record, name: clean }
      save()
      emit()
      return snapshot()
    },

    wipe() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      record = null
      deletePetFile(filePath)
      emit()
    },

    feed() {
      if (!record) return null
      catchUp(now())
      const result = feed(record.needs, config)
      if (!result.refused) {
        record = {
          ...record,
          needs: result.needs,
          counters: { ...record.counters, feeds: record.counters.feeds + 1 }
        }
        saveSoon()
      }
      emit()
      return { refused: result.refused }
    },

    pet() {
      if (!record) return null
      const t = now()
      catchUp(t)
      const result = pet(record.needs, t, lastPetAt, config)
      if (result.counted) {
        lastPetAt = t
        record = {
          ...record,
          needs: result.needs,
          counters: { ...record.counters, pets: record.counters.pets + 1 }
        }
        saveSoon()
      }
      emit()
      return { counted: result.counted }
    },

    click() {
      if (!record) return null
      const t = now()
      catchUp(t)
      const result = click(record.needs, t, lastClickAt, config)
      if (result.counted) {
        lastClickAt = t
        record = { ...record, needs: result.needs }
        saveSoon()
      }
      emit()
      return { counted: result.counted }
    },

    earnTreats(count) {
      if (!record) return null
      const next = earnTreats(record.treats, count, config)
      const added = next - record.treats
      if (added > 0) {
        record = { ...record, treats: next }
        saveSoon()
        emit()
      }
      return added
    },

    giveTreat() {
      if (!record || record.treats < 1) return null
      catchUp(now())
      const result = treat(record.needs, config)
      record = { ...record, needs: result.needs, treats: record.treats - 1 }
      saveSoon()
      emit()
      return { full: result.full }
    },

    onChange(listener) {
      listeners.push(listener)
    },

    flush() {
      if (!record) return
      catchUp(now())
      save()
    },

    dispose() {
      if (tickTimer) clearInterval(tickTimer)
      tickTimer = null
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      listeners.length = 0
    }
  }
}
