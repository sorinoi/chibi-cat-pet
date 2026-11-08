import { net } from 'electron'
import { join } from 'node:path'
import { ACTIVITY } from './config'
import { createActivityKeyStore } from './activityKey'
import { createActivityLog, readOrCreateDeviceId, type ActivityPetState } from './lib/activityLog'
import { createActivitySender } from './lib/activitySender'
import { createOutbox } from './lib/outbox'
import type { ActivityItem } from '../shared/activity'
import type { ActivityTestResult, ActivityView } from '../shared/ipc'
import type { Settings } from '../shared/settings'

/**
 * requirement-v6.md sections 4 to 6: the activity log in main. Only main sends (net.fetch),
 * only to the URL in Settings and only while the switch is on (section 7). Sending never
 * blocks anything and never shows a popup; problems show in the Settings status (NFR-31).
 */
export interface Activity {
  record(item: ActivityItem, pet: ActivityPetState | null): void
  view(): ActivityView
  setKey(key: string): boolean
  test(): Promise<ActivityTestResult>
  /** FR-88: empties the outbox. */
  clear(): void
  /** The switch or URL may have changed. */
  settingsChanged(next: Settings, previous: Settings): void
  /** The PC woke up: the network may be back. */
  resumed(): void
  onChanged(listener: (view: ActivityView) => void): void
  dispose(): void
}

export function createActivity(
  userData: string,
  settings: () => Settings,
  appVersion: string
): Activity {
  const listeners: Array<(view: ActivityView) => void> = []
  const keys = createActivityKeyStore(join(userData, ACTIVITY.keyFile))
  const outbox = createOutbox({
    path: join(userData, ACTIVITY.outboxFile),
    maxEvents: ACTIVITY.maxEvents,
    maxAgeMs: ACTIVITY.maxAgeDays * 24 * 60 * 60_000
  })

  const view = (): ActivityView => ({ state: sender.state(), hasKey: keys.has() })
  const publish = (): void => {
    const v = view()
    listeners.forEach((fn) => fn(v))
  }

  const sender = createActivitySender({
    outbox,
    target: () => ({
      enabled: settings().activityLog,
      url: settings().activityServerUrl,
      key: keys.get()
    }),
    fetch: (url, init) => net.fetch(url, init),
    timing: ACTIVITY,
    onState: publish
  })

  // The device id is made only once the switch is first turned on (nothing to name before).
  let log: ReturnType<typeof createActivityLog> | null = null
  const getLog = (): ReturnType<typeof createActivityLog> => {
    log ??= createActivityLog({
      outbox,
      enabled: () => settings().activityLog,
      onRecorded: () => sender.kick(),
      device: readOrCreateDeviceId(join(userData, ACTIVITY.deviceFile)),
      app: appVersion
    })
    return log
  }

  // Events left from an earlier run go out once the app is up.
  if (settings().activityLog && outbox.count() > 0) sender.kick()

  return {
    record(item, pet) {
      if (!pet || !settings().activityLog) return
      getLog().record(item, pet)
    },
    view,
    setKey(key) {
      const ok = keys.set(key)
      if (ok) sender.targetChanged()
      publish()
      return ok
    },
    test: () => sender.test(),
    clear() {
      outbox.clear()
      sender.cleared()
      publish()
    },
    settingsChanged(next, previous) {
      if (
        next.activityLog !== previous.activityLog ||
        next.activityServerUrl !== previous.activityServerUrl
      )
        sender.targetChanged()
    },
    resumed: () => sender.retryNow(),
    onChanged(listener) {
      listeners.push(listener)
    },
    dispose() {
      sender.dispose()
      listeners.length = 0
    }
  }
}
