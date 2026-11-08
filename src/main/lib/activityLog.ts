/**
 * requirement-v6.md FR-81..FR-83: turns care and focus activity into events, puts them in the
 * outbox and lets the sender know. No Electron imports, unit tested.
 */
import {
  ACTIVITY_SCHEMA_VERSION,
  parseActivityEvent,
  type ActivityItem,
  type ActivityMood
} from '../../shared/activity'
import { readJson, writeJsonAtomic } from './jsonFile'
import type { Outbox } from './outbox'

/** The pet as the care engine sees it right after the action. */
export interface ActivityPetState {
  id: string
  name: string
  adoptedAt: number
  needs: { hunger: number; happiness: number }
  mood: ActivityMood
}

export interface ActivityLog {
  record(item: ActivityItem, pet: ActivityPetState): void
}

export interface ActivityLogOptions {
  outbox: Outbox
  /** FR-83: events are recorded only while the switch is on. */
  enabled: () => boolean
  /** Called after an event went into the outbox (the sender's kick). */
  onRecorded: () => void
  device: string
  app: string
  now?: () => number
  newId?: () => string
}

const twoDecimals = (v: number): number => Math.round(v * 100) / 100

/** Minutes east of UTC at time `t` (Bangkok: 420). */
export const utcOffsetMinutes = (t: number): number => -new Date(t).getTimezoneOffset()

export function createActivityLog({
  outbox,
  enabled,
  onRecorded,
  device,
  app,
  now = () => Date.now(),
  newId = () => globalThis.crypto.randomUUID()
}: ActivityLogOptions): ActivityLog {
  return {
    record(item, pet) {
      if (!enabled()) return
      const at = now()
      const event = parseActivityEvent({
        v: ACTIVITY_SCHEMA_VERSION,
        id: newId(),
        type: item.type,
        at,
        tz: utcOffsetMinutes(at),
        device,
        app,
        pet: {
          id: pet.id,
          name: pet.name,
          adoptedAt: pet.adoptedAt,
          hunger: twoDecimals(pet.needs.hunger),
          happiness: twoDecimals(pet.needs.happiness),
          mood: pet.mood
        },
        data: item.data
      })
      // The app made it, so this never happens; if it ever does, never send a bad event.
      if (!event) {
        console.warn(`Activity event ${item.type} did not pass its own check; not recorded`)
        return
      }
      try {
        outbox.append(event)
      } catch (err) {
        console.error('Could not write the activity outbox:', err)
        return
      }
      onRecorded()
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** FR-82: this install's random id, made once and kept in `path`. */
export function readOrCreateDeviceId(
  path: string,
  newId: () => string = () => globalThis.crypto.randomUUID()
): string {
  const raw = readJson(path)
  if (typeof raw === 'object' && raw !== null) {
    const id = (raw as Record<string, unknown>)['id']
    if (typeof id === 'string' && UUID.test(id)) return id.toLowerCase()
  }
  const id = newId()
  try {
    writeJsonAtomic(path, { version: 1, id })
  } catch (err) {
    console.error('Could not save the device id:', err)
  }
  return id
}
