/**
 * Single source of truth for IPC channels and the preload API shape.
 * Channel names follow the `domain:action` convention.
 */
import type { Settings } from './settings'

export const IpcChannel = {
  /** renderer -> main (send): boolean, true = mouse passes through the window. */
  WindowSetIgnoreMouse: 'window:set-ignore-mouse',
  /** renderer -> main (send): the window starts following the cursor. */
  PetDragStart: 'pet:drag-start',
  /** renderer -> main (send): the window stops following the cursor. */
  PetDragEnd: 'pet:drag-end',
  /** renderer -> main (invoke): WalkRequest -> planned dx (number, 0 = no room). */
  PetWalkStart: 'pet:walk-start',
  /** renderer -> main (send): stop walking now. */
  PetWalkStop: 'pet:walk-stop',
  /** main -> renderer: WalkEnded. */
  PetWalkEnded: 'pet:walk-ended',
  /** main -> renderer: boolean, true = the user has not touched the machine for a while. */
  SystemUserIdle: 'system:user-idle',
  /** pet renderer -> main (send): right-click on the cat (FR-10). */
  PetShowContextMenu: 'pet:show-context-menu',
  /** settings renderer -> main (invoke): -> SettingsSnapshot. */
  SettingsGet: 'settings:get',
  /** settings renderer -> main (invoke): Partial<Settings> -> Settings (sanitized). */
  SettingsUpdate: 'settings:update',
  /** main -> settings renderer: Settings, after any change. */
  SettingsChanged: 'settings:changed'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

export interface WalkRequest {
  /** Desired horizontal distance in DIP; the sign is the direction. */
  dx: number
  /** DIP per second. */
  speed: number
}

export interface WalkEnded {
  /** false when the walk was stopped before reaching the target. */
  completed: boolean
}

/** API exposed to the renderer as `window.petApi` via contextBridge. */
export interface PetApi {
  /** true: mouse passes through the window. false: the window receives mouse input. */
  setIgnoreMouseEvents(ignore: boolean): void
  startDrag(): void
  endDrag(): void
  /** Starts walking. Resolves with the distance actually planned after clamping (0 = no room). */
  startWalk(request: WalkRequest): Promise<number>
  stopWalk(): void
  /** Returns an unsubscribe function. */
  onWalkEnded(listener: (event: WalkEnded) => void): () => void
  /** Returns an unsubscribe function. */
  onUserIdleChanged(listener: (idle: boolean) => void): () => void
  /** Opens the pet's right-click menu at the cursor. */
  showContextMenu(): void
}

export interface SettingsSnapshot {
  settings: Settings
  appVersion: string
  /** false in dev builds, where "start with Windows" is saved but not applied. */
  canStartWithWindows: boolean
}

/** API exposed to the settings window as `window.settingsApi`. */
export interface SettingsApi {
  get(): Promise<SettingsSnapshot>
  update(patch: Partial<Settings>): Promise<Settings>
  /** Returns an unsubscribe function. */
  onChanged(listener: (settings: Settings) => void): () => void
}
