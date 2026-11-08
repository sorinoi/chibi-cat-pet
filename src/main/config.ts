import { ACTIVE_MODEL } from '../shared/activeModel'
import { modelFrame } from '../shared/modelConfig'

/** Main-process constants. Sizes are in DIP (device-independent pixels). */

const { displayScale, edgeOverflow } = ACTIVE_MODEL
const frame = modelFrame(ACTIVE_MODEL)

/**
 * requirement-v5.md section 8: distance from the pet window's centre line to where the paws
 * touch the wall, as a share of the window width (the frame is fitted to the window).
 */
function wallShare(name: 'climb' | 'hang'): number | null {
  const clip = ACTIVE_MODEL.clips[name]
  if (clip?.wallX === undefined) return null
  const sheet = ACTIVE_MODEL.sheets[clip.sheet]
  return ((clip.wallX - sheet.anchor.x) * sheet.scale) / frame.width
}

/** Wall points of the climb and hang clips; null without climb art (no climbing, FR-76). */
export const WALL = { climb: wallShare('climb'), hang: wallShare('hang') ?? wallShare('climb') }

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
  /** requirement-v8.md FR-111: chance a walk keeps the last walk's direction (patrol). */
  patrolKeepChance: 0.75,
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
  /** requirement-v5.md FR-73..75: jumping; sizes in pet window heights/widths. */
  jump: {
    /** Crouch and push off before the window moves (the jump clip's first two frames). */
    takeoffMs: 220,
    /** Window step in the air (~30 Hz, the NFR-02 cap). */
    intervalMs: 33,
    /** Flight time: base plus per DIP of distance, up to a limit. */
    baseMs: 350,
    msPerDip: 0.9,
    maxMs: 900,
    /** Top of the arc above the higher end. */
    liftFactor: 0.35,
    /** A jump up rises at least / at most this much (feet to edge). */
    minRiseFactor: 0.4,
    maxRiseFactor: 3,
    /** ...and lands at most this far sideways. */
    maxSideFactor: 4,
    /** A jump down lands this far past the end of the perch (centre), then falls. */
    downClearanceFactor: 0.6,
    /** Within this many DIP of an end of the walkable stretch counts as "at the end". */
    endSlack: 8
  },
  /** requirement-v5.md FR-76: climbing a screen edge. Speeds in DIP/s at pet size 1.0. */
  climb: {
    intervalMs: 33,
    /** Walking to the wall, like a normal walk. */
    walkSpeed: 45,
    /** At the wall, the climb clip's intro (sit, reach, leap) plays before it goes up. */
    startDelayMs: 950,
    climbSpeed: 70,
    /** Climb height: a random share of the work area height. */
    riseShare: { minShare: 0.25, maxShare: 0.75 },
    /** Climbs shorter than this many pet window heights are not worth starting. */
    minRiseFactor: 0.5,
    /** Holding on at the top before letting go. */
    holdMs: { min: 2000, max: 5000 }
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
  height: 920
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

/** requirement-v6.md sections 5 and 6: the activity log client (NFR-38). */
export const ACTIVITY = {
  /** Events waiting to be sent, one JSON per line (FR-89, FR-90). */
  outboxFile: 'outbox.jsonl',
  /** This install's random id (FR-82). */
  deviceFile: 'device.json',
  /** The API key, encrypted with Windows' safeStorage (NFR-34). */
  keyFile: 'activity-key.bin',
  /** FR-84: events per request. */
  batchSize: 100,
  /** FR-85: give up on one request after this long. */
  timeoutMs: 10_000,
  /** FR-85: wait this long after a failure, doubling each time, up to retryMaxMs. */
  retryMinMs: 60_000,
  retryMaxMs: 30 * 60_000,
  /** FR-89: the outbox keeps at most this many events, none older than maxAgeDays. */
  maxEvents: 10_000,
  maxAgeDays: 30
} as const
