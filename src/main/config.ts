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
  /** requirement-v5.md FR-60 / NFR-26: a fall from the top of a 1080p screen takes ~1 s. */
  fall: {
    /** Window step while falling (~30 Hz, the NFR-02 cap). */
    intervalMs: 33,
    /** DIP per second squared. */
    gravity: 2000,
    /** DIP per second. */
    maxSpeed: 2400,
    /** A cat this close above the floor counts as standing (start positions snap to 4 DIP). */
    restTolerance: 2
  },
  /** requirement-v5.md FR-66, FR-67: landing on other apps' windows, in pet window widths. */
  perch: {
    /** Narrower windows are not perches. */
    minWidthFactor: 2,
    /** Half the part of the edge under the cat that must be visible (not covered). */
    footHalfWidthFactor: 0.2,
    /** FR-68: the cat's centre stays this far inside the window's side edges when walking. */
    edgeMarginFactor: 0.2,
    /** NFR-25: checks of the perch window while it is still (4 Hz). */
    pollMs: 250,
    /** NFR-26: checks while it moves (~30 Hz), for fastForMs after the last change. */
    fastPollMs: 33,
    fastForMs: 1000
  },
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

/** Today's focus count (requirement-v3.md FR-40). */
export const FOCUS_FILE = 'focus.json'

export const STORE = {
  fileName: 'settings.json',
  /** Batch rapid changes (slider drags, walking) into one write. */
  saveDebounceMs: 500
} as const

export const SETTINGS_WINDOW = {
  width: 820,
  height: 790
} as const

export const ADOPT_WINDOW = {
  width: 380,
  height: 440
} as const

/** Registry value name for the Run key. build/installer.nsh deletes the same name on uninstall. */
export const LOGIN_ITEM_NAME = 'DesktopPet'

/** Paths relative to app.getAppPath() (project root in dev, app.asar when packaged). */
export const RESOURCES = {
  trayIcon: 'resources/tray.png',
  appIcon: 'resources/icon.png'
} as const

/** Must match `appId` in electron-builder.yml (notifications, FR-37). */
export const APP_USER_MODEL_ID = 'com.sorinoi.desktoppet'
