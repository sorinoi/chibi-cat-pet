/** Main-process constants. Sizes are in DIP (device-independent pixels). */
export const PET_WINDOW = {
  /** Size at pet size 1.0. Wider than tall so the cat fits in side view while walking. */
  width: 380,
  height: 300,
  /** Gap between the window and the work area edge on first launch (lower right). */
  edgeMargin: 24
} as const

export const MOTION = {
  /** Cursor polling while dragging (~60 Hz). */
  dragIntervalMs: 16,
  /** Window step while walking (~30 Hz, matches the render cap). */
  walkIntervalMs: 33,
  /** Upper bound for a requested walk speed, DIP per second. */
  maxWalkSpeed: 400,
  /** Walks shorter than this are not worth starting. */
  minWalkDistance: 40,
  /**
   * How far the window may hang past the work area edge at pet size 1.0. The window has
   * transparent margins around the cat, so a little overflow lets the cat reach the edges.
   */
  overflow: { x: 60, top: 0, bottom: 40 }
} as const

export const USER_IDLE = {
  pollIntervalMs: 5000
} as const

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
