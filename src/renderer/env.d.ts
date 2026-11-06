import type { AdoptApi, PetApi, SettingsApi } from '../shared/ipc'
import type { PetEvent, PetState } from './lib/petMachine'
import type { ClipName } from '../shared/modelConfig'

/** Dev builds only (see usePetBehavior). */
interface PetDebug {
  dispatch(event: PetEvent): void
  state(): PetState
  scene(): { clip: string; frame: number; facing: string }
  playClip(clip: ClipName): void
  mood(): string | null
  wanderNow(): void
  setUserIdle(idle: boolean): void
}

declare global {
  interface Window {
    /** Pet window only (src/preload/index.ts). */
    petApi: PetApi
    /** Settings window only (src/preload/settings.ts). */
    settingsApi: SettingsApi
    /** Adoption window only (src/preload/adopt.ts). */
    adoptApi: AdoptApi
    __petDebug?: PetDebug
  }
}

export {}
