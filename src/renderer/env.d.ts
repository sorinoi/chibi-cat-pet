import type { AdoptApi, CursorNear, PetApi, SettingsApi } from '../shared/ipc'
import type { PetEvent, PetState } from './lib/petMachine'
import type { ClipName } from '../shared/modelConfig'

/** Dev builds only (see usePetBehavior). */
interface PetDebug {
  dispatch(event: PetEvent): void
  state(): PetState
  scene(): { clip: string; frame: number; facing: string; look: string }
  playClip(clip: ClipName): void
  mood(): string | null
  wanderNow(): void
  /** Draw the cat in a look, in the pet window only (requirement-v7.md FR-107). */
  setLook(look: string | null): void
  /** Try a jump now (requirement-v5.md FR-73). */
  jumpNow(): void
  /** Try a climb now (requirement-v5.md FR-76). */
  climbNow(): void
  setUserIdle(idle: boolean): void
  /** Feed a cursor position as if main sent it (look at the mouse). */
  cursor(position: CursorNear): void
  /** Whether the pet asked main for cursor updates. */
  lookWatching(): boolean
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
