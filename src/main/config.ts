import { ACTIVE_MODEL } from '../shared/activeModel'
import { modelFrame } from '../shared/modelConfig'

/** Main-process constants. Sizes are in DIP (device-independent pixels). */

const { displayScale, edgeOverflow } = ACTIVE_MODEL
const frame = modelFrame(ACTIVE_MODEL)

export const PET_WINDOW = {
  /** Size at pet size 1.0: the model frame that fits every sprite sheet. */
  width: Math.round(frame.width * displayScale),
  height: Math.round(frame.height * displayScale),
  /** Gap between the window and the work area edge on first launch (lower right). */
  edgeMargin: 24
} as const

export const MOTION = {
  /** Cursor polling while dragging (~60 Hz). */
  dragIntervalMs: 16,
  /** Window step while walking (~30 Hz, the NFR-02 cap). */
  walkIntervalMs: 33,
  /** Upper bound for a requested walk speed, DIP per second. */
  maxWalkSpeed: 400,
  /** Walks shorter than this are not worth starting. */
  minWalkDistance: 40,
  /**
   * How far the window may hang past the work area edge at pet size 1.0: the cell's
   * always-empty margins, so the cat itself can reach the edges.
   */
  overflow: {
    x: Math.round(edgeOverflow.x * displayScale),
    top: Math.round(edgeOverflow.top * displayScale),
    bottom: Math.round(edgeOverflow.bottom * displayScale)
  }
} as const

export const USER_IDLE = {
  pollIntervalMs: 5000
} as const

export const FULLSCREEN = {
  /** FR-16: how often to ask Windows whether a fullscreen app is in front. */
  pollIntervalMs: 2000
} as const

/** v2 pet data (FR-30), next to settings.json. Deleted on uninstall with the rest. */
export const PET_FILE = 'pet.json'

export const STORE = {
  fileName: 'settings.json',
  /** Batch rapid changes (slider drags, walking) into one write. */
  saveDebounceMs: 500
} as const

export const SETTINGS_WINDOW = {
  width: 420,
  height: 470
} as const

/** Registry value name for the Run key. build/installer.nsh deletes the same name on uninstall. */
export const LOGIN_ITEM_NAME = 'DesktopPet'

/** Paths relative to app.getAppPath() (project root in dev, app.asar when packaged). */
export const RESOURCES = {
  trayIcon: 'resources/tray.png',
  appIcon: 'resources/icon.png'
} as const
