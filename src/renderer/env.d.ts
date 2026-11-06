import type { PetApi, SettingsApi } from '../shared/ipc'
import type { PetEvent, PetState } from './lib/petMachine'

/** Dev builds only (see usePetBehavior). */
interface PetDebug {
  dispatch(event: PetEvent): void
  state(): PetState
  scene(): { clip: string; frame: number; facing: string }
  setUserIdle(idle: boolean): void
}

declare global {
  interface Window {
    /** Pet window only (src/preload/index.ts). */
    petApi: PetApi
    /** Settings window only (src/preload/settings.ts). */
    settingsApi: SettingsApi
    __petDebug?: PetDebug
  }
}

export {}
