/**
 * Single source of truth for IPC channels and the preload API shape.
 * Channel names follow the `domain:action` convention.
 */
import type { Mood } from './needs'
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
  SettingsChanged: 'settings:changed',
  /** main -> pet renderer: CareView | null (no pet yet), on load and after every change. */
  CareState: 'care:state',
  /**
   * main -> pet renderer: CareRequest from a menu (FR-17, FR-19). The renderer decides whether
   * the pet can react now and, if so, applies it with care:act.
   */
  CareRequest: 'care:request',
  /** pet renderer -> main (invoke): CareAct -> CareActResult | null (no pet). */
  CareAct: 'care:act'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

export interface WalkRequest {
  /** Desired horizontal distance in DIP; the sign is the direction. */
  dx: number
  /** DIP per second. */
  speed: number
}

/** What the pet renderer needs to know about care (section 5). */
export interface CareView {
  mood: Mood
}

/** A care action asked for from a menu. */
export type CareRequest = 'feed' | 'pet'

/** Care actions the pet renderer applies: feed, pet (menu or stroke, FR-18) or click (FR-20). */
export type CareAct = 'feed' | 'pet' | 'click'

export interface CareActResult {
  /** false inside a cooldown or when refused: the animation may play, nothing changes. */
  counted: boolean
  /** feed only: the pet was too full to eat (it plays the click reaction instead). */
  refused: boolean
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
  /** Returns an unsubscribe function. */
  onCareState(listener: (view: CareView | null) => void): () => void
  /** Returns an unsubscribe function. */
  onCareRequest(listener: (request: CareRequest) => void): () => void
  /** Applies a care action in main; resolves null when there is no pet. */
  careAct(act: CareAct): Promise<CareActResult | null>
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
