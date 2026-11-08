/**
 * Single source of truth for IPC channels and the preload API shape.
 * Channel names follow the `domain:action` convention.
 */
import type { Mood, Needs } from './needs'
import type { Settings } from './settings'
import type { Language } from './strings'
import type { FocusReaction, FocusView } from './focusText'

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
  CareAct: 'care:act',
  /** adoption window -> main (invoke): name -> boolean (adopted). */
  CareAdopt: 'care:adopt',
  /** settings -> main (invoke): -> CareView | null. */
  CareGet: 'care:get',
  /** main -> settings: CareView | null, after every change. */
  CareChanged: 'care:changed',
  /** settings -> main (invoke): name -> CareView | null (null = name not usable). */
  CareRename: 'care:rename',
  /** settings -> main (invoke): look id -> CareView | null (requirement-v7.md FR-107). */
  CareSetLook: 'care:set-look',
  /** settings -> main (invoke): confirm, wipe, open adoption -> boolean (wiped). */
  CareAdoptNew: 'care:adopt-new',
  /** settings -> main (send): open the adoption window (no pet yet). */
  CareOpenAdopt: 'care:open-adopt',
  /** pet or adoption window -> main (invoke): -> Language (FR-43). */
  AppGetLanguage: 'app:get-language',
  /** main -> pet and adoption windows: Language, after it changes (FR-44). */
  AppLanguageChanged: 'app:language-changed',
  /** pet or settings -> main (invoke): -> FocusView (FR-36, FR-39). */
  FocusGet: 'focus:get',
  /** main -> pet and settings: FocusView, after every change and once a minute while running. */
  FocusState: 'focus:state',
  /** pet -> main (send): boolean, start or stop cursor updates (requirement-v4.md FR-57). */
  PetLookWatch: 'pet:look-watch',
  /** main -> pet: CursorNear, while watching and only when the cursor moved. */
  PetCursor: 'pet:cursor',
  /** main -> pet: FocusReaction to play at a phase change (FR-38). */
  FocusReaction: 'focus:reaction',
  /** main -> pet: the cat started falling on its own (requirement-v5.md FR-63). */
  PetFallStart: 'pet:fall-start',
  /** main -> pet: the cat is standing again after a drop or fall (FR-60). */
  PetLanded: 'pet:landed',
  /** pet -> main (invoke): -> JumpStarted | null (no jump fits now) (FR-73, FR-75). */
  PetJumpStart: 'pet:jump-start',
  /** pet -> main (send): the pet could not show the jump; end it. */
  PetJumpStop: 'pet:jump-stop',
  /** pet -> main (invoke): -> ClimbStarted | null (FR-76). */
  PetClimbStart: 'pet:climb-start',
  /** pet -> main (send): the pet could not show the climb; end it. */
  PetClimbStop: 'pet:climb-stop',
  /** main -> pet: ClimbPhase, when the cat reaches the wall and the top (FR-76). */
  PetClimbPhase: 'pet:climb-phase',
  /** settings -> main (invoke): -> ActivityView (requirement-v6.md FR-87). */
  ActivityGet: 'activity:get',
  /** main -> settings: ActivityView, after every change. */
  ActivityChanged: 'activity:changed',
  /** settings -> main (invoke): string (empty removes it) -> boolean stored (NFR-34). */
  ActivitySetKey: 'activity:set-key',
  /** settings -> main (invoke): -> ActivityTestResult (FR-87, FR-92). */
  ActivityTest: 'activity:test',
  /** settings -> main (invoke): confirm, then empty the outbox -> boolean cleared (FR-88). */
  ActivityClear: 'activity:clear'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

export interface WalkRequest {
  /** Desired horizontal distance in DIP; the sign is the direction. */
  dx: number
  /** DIP per second. */
  speed: number
}

/** Care status sent to the pet (mood, tooltip) and settings windows (FR-24, FR-27). */
export interface CareView {
  name: string
  needs: Needs
  mood: Mood
  /** Epoch ms. */
  adoptedAt: number
  /** Treats in stock (requirement-v4.md FR-53). */
  treats: number
  /** requirement-v7.md FR-103: the cat's look; null = the model's default. */
  look: string | null
}

/** A care action asked for from a menu, or the welcome scene right after adoption. */
export type CareRequest = 'feed' | 'pet' | 'welcome' | 'treat'

/** Care actions the pet renderer applies: feed, pet (menu or stroke, FR-18) or click (FR-20). */
export type CareAct = 'feed' | 'pet' | 'click' | 'treat'

export interface CareActResult {
  /** false inside a cooldown or when refused: the animation may play, nothing changes. */
  counted: boolean
  /** feed only: the pet was too full to eat (it plays the click reaction instead). */
  refused: boolean
  /** treat only: the cat was already full (it plays happy instead of eat). */
  full?: boolean
}

/** Cursor position relative to the pet window, plus the window size, in DIP (FR-56). */
export interface CursorNear {
  x: number
  y: number
  width: number
  height: number
}

/** A jump main has started (requirement-v5.md FR-73, FR-75). */
export interface JumpStarted {
  /** Sideways distance in DIP; its sign is the direction the cat faces. */
  dx: number
}

/** A climb main has started (requirement-v5.md FR-76): it walks to this side's wall first. */
export interface ClimbStarted {
  side: 'left' | 'right'
}

/** climb: at the wall, going up; hold: at the top, holding on (then a fall). */
export type ClimbPhase = 'climb' | 'hold'

export interface WalkEnded {
  /** false when the walk was stopped before reaching the target. */
  completed: boolean
}

/** UI language for windows that do not read the settings (FR-43, FR-44). */
export interface LanguageApi {
  getLanguage(): Promise<Language>
  /** Returns an unsubscribe function. */
  onLanguageChanged(listener: (language: Language) => void): () => void
}

/** API exposed to the renderer as `window.petApi` via contextBridge. */
export interface PetApi extends LanguageApi {
  /** true: mouse passes through the window. false: the window receives mouse input. */
  setIgnoreMouseEvents(ignore: boolean): void
  startDrag(): void
  /** Drops the cat: main lets it fall (Gravity on, in the air) and then sends pet:landed. */
  endDrag(): void
  /** Returns an unsubscribe function (requirement-v5.md FR-63). */
  onFallStart(listener: () => void): () => void
  /** Returns an unsubscribe function (FR-60). */
  onLanded(listener: () => void): () => void
  /** FR-73, FR-75: main jumps if a jump fits; ends with pet:landed or pet:fall-start. */
  startJump(): Promise<JumpStarted | null>
  stopJump(): void
  /** FR-76: main walks to a screen edge, climbs, holds on and lets go (pet:climb-phase). */
  startClimb(): Promise<ClimbStarted | null>
  stopClimb(): void
  /** Returns an unsubscribe function. */
  onClimbPhase(listener: (phase: ClimbPhase) => void): () => void
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
  getFocus(): Promise<FocusView>
  /** Returns an unsubscribe function. */
  onFocusState(listener: (view: FocusView) => void): () => void
  /** Returns an unsubscribe function. */
  onFocusReaction(listener: (reaction: FocusReaction) => void): () => void
  /** FR-57: ask main to send cursor positions (only while the cat could look). */
  setLookWatch(on: boolean): void
  /** Returns an unsubscribe function. */
  onCursor(listener: (position: CursorNear) => void): () => void
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
  getCare(): Promise<CareView | null>
  /** Returns an unsubscribe function. */
  onCareChanged(listener: (view: CareView | null) => void): () => void
  /** Resolves null when the name is not usable. */
  renamePet(name: string): Promise<CareView | null>
  /** requirement-v7.md FR-107: repaints the cat; resolves null without a cat. */
  setLook(look: string): Promise<CareView | null>
  /** Asks for confirmation; on yes deletes the pet and opens adoption. Resolves true if wiped. */
  adoptNew(): Promise<boolean>
  openAdopt(): void
  getFocus(): Promise<FocusView>
  /** Returns an unsubscribe function. */
  onFocusChanged(listener: (view: FocusView) => void): () => void
  /** requirement-v6.md FR-87. */
  getActivity(): Promise<ActivityView>
  /** Returns an unsubscribe function. */
  onActivityChanged(listener: (view: ActivityView) => void): () => void
  /** Stores the API key encrypted; an empty string removes it. Resolves false if it could not. */
  setActivityKey(key: string): Promise<boolean>
  testActivity(): Promise<ActivityTestResult>
  /** FR-88: asks for confirmation, then empties the outbox. Resolves true if cleared. */
  clearActivity(): Promise<boolean>
}

/** requirement-v6.md FR-85, FR-87: where sending stands, for the Settings status line. */
export type ActivityState = {
  /** Events in the outbox. */
  waiting: number
  /** Events dropped by the outbox limits since the app started (FR-89). */
  dropped: number
  /** Epoch ms of the last accepted batch since the app started. */
  lastSentAt: number | null
} & (
  | { kind: 'off' }
  | { kind: 'notSet' }
  | { kind: 'badUrl' }
  | { kind: 'ready' }
  | { kind: 'sending' }
  | { kind: 'retrying'; retryAt: number; reason: 'offline' | 'server' | 'busy' }
  | { kind: 'refused'; reason: 'unauthorized' | 'badData' | 'other'; code: number }
)

export interface ActivityView {
  state: ActivityState
  /** An API key is stored (the key itself never leaves main). */
  hasKey: boolean
}

export type ActivityTestResult =
  | { ok: true }
  | { ok: false; reason: 'notSet' | 'badUrl' | 'unauthorized' | 'unreachable' }
  | { ok: false; reason: 'server'; code: number }

/** API exposed to the adoption window as `window.adoptApi`. */
export interface AdoptApi extends LanguageApi {
  /** Resolves false when the name is not usable. */
  adopt(name: string, look: string): Promise<boolean>
}
