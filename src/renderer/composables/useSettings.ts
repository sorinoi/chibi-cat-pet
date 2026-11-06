import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Settings } from '../../shared/settings'

export interface UseSettings {
  /** null until loaded from the main process. */
  settings: Ref<Settings | null>
  appVersion: Ref<string>
  canStartWithWindows: Ref<boolean>
  /** Sends one change; the main process sanitizes it and the result is shown. */
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
}

/** Settings window state. Main is the source of truth; this mirrors it. */
export function useSettings(): UseSettings {
  const api = window.settingsApi
  const settings = ref<Settings | null>(null)
  const appVersion = ref('')
  const canStartWithWindows = ref(true)
  let unsubscribe: (() => void) | null = null

  onMounted(async () => {
    unsubscribe = api.onChanged((next) => {
      settings.value = next
    })
    const snapshot = await api.get()
    settings.value = snapshot.settings
    appVersion.value = snapshot.appVersion
    canStartWithWindows.value = snapshot.canStartWithWindows
  })

  onBeforeUnmount(() => unsubscribe?.())

  return {
    settings,
    appVersion,
    canStartWithWindows,
    async set(key, value) {
      settings.value = await api.update({ [key]: value })
    }
  }
}
