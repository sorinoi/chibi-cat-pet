import { app, type BrowserWindow, type Tray } from 'electron'
import { join } from 'node:path'
import { createAppActions } from './appActions'
import { createCareEngine } from './careEngine'
import { applySettings } from './applySettings'
import { PET_FILE, STORE } from './config'
import { registerIpcHandlers } from './ipc'
import { createTray, showPetContextMenu } from './menus'
import { createPetMotion } from './petMotion'
import { createPetWindow } from './petWindow'
import { lockDownWebContents } from './security'
import { createSettingsStore } from './settingsStore'
import { createSettingsWindowManager } from './settingsWindow'
import { watchFullscreen } from './fullscreenWatcher'
import { watchUserIdle } from './userIdle'
import { IpcChannel, type CareRequest } from '../shared/ipc'

const SECONDS_PER_MINUTE = 60

// Dev runs get their own data folder so they never touch the installed app's settings.
// Must run before the single-instance lock, which lives in userData.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')}-dev`)

// Keep references so the tray icon is not garbage collected.
let tray: Tray | null = null
let petWindow: BrowserWindow | null = null

/** `"Desktop Pet.exe" --settings` opens the settings window (also when already running). */
const SETTINGS_FLAG = '--settings'
let openSettingsFromArgs: (argv: readonly string[]) => void = () => {}

function start(): void {
  const store = createSettingsStore(
    join(app.getPath('userData'), STORE.fileName),
    STORE.saveDebounceMs
  )
  const settingsWindow = createSettingsWindowManager()

  // v2 pet care (requirement-v2.md sections 4 and 11). Inactive until a pet is adopted.
  const care = createCareEngine({ filePath: join(app.getPath('userData'), PET_FILE) })
  care.load()
  care.start()

  const win = createPetWindow({ version: 1, settings: store.settings, position: store.position })
  petWindow = win
  const sendToPet = (channel: string, payload?: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  const motion = createPetMotion(win, store.settings.petSize, {
    onWalkEnded: (event) => sendToPet(IpcChannel.PetWalkEnded, event),
    onSettled: (position) => store.setPosition(position) // FR-04
  })

  // v2 care state for the pet renderer: its mood drives behavior (section 5).
  const sendCareState = (): void => {
    const s = care.current()
    sendToPet(IpcChannel.CareState, s ? { mood: s.mood } : null)
  }
  care.onChange(sendCareState)
  win.webContents.on('did-finish-load', sendCareState)

  /**
   * Menu care actions are requests: the pet renderer knows whether the cat can react right
   * now (a care action during another care animation is ignored) and applies it via care:act.
   */
  const request = (action: CareRequest): void => {
    if (!care.current()) return
    if (!win.isDestroyed() && !win.isVisible()) win.showInactive()
    sendToPet(IpcChannel.CareRequest, action)
  }

  const actions = createAppActions(
    () => (win.isDestroyed() ? null : win),
    () => settingsWindow.open(),
    () => motion.stopWalk(),
    {
      hasPet: () => care.current() !== null,
      feed: () => request('feed'),
      pet: () => request('pet')
    }
  )

  const unregister = registerIpcHandlers({
    petWindow: win,
    getSettingsWindow: settingsWindow.get,
    motion,
    store,
    care,
    showContextMenu: () => showPetContextMenu(win, actions)
  })

  const userIdle = watchUserIdle(
    () => store.settings.sleepAfterMinutes * SECONDS_PER_MINUTE,
    (idle) => {
      care.setAsleep(idle)
      sendToPet(IpcChannel.SystemUserIdle, idle)
    }
  )
  // A reloaded page starts awake; tell it if the user is already away.
  win.webContents.on('did-finish-load', () => {
    if (userIdle.idle) sendToPet(IpcChannel.SystemUserIdle, true)
  })

  // FR-16: step aside while a fullscreen app is in front, then come back, unless the
  // user hid the pet from the tray in the meantime.
  let hiddenForFullscreen = false
  const fullscreen = watchFullscreen((isFullscreen) => {
    if (win.isDestroyed()) return
    if (isFullscreen && win.isVisible()) {
      hiddenForFullscreen = true
      motion.stopWalk()
      motion.endDrag()
      win.hide()
    } else if (!isFullscreen && hiddenForFullscreen) {
      hiddenForFullscreen = false
      win.showInactive()
    }
  })

  applySettings(win, motion, store.settings, null)
  store.onChange((next, previous) => {
    applySettings(win, motion, next, previous)
    settingsWindow.get()?.webContents.send(IpcChannel.SettingsChanged, next)
  })

  tray = createTray(actions)
  openSettingsFromArgs = (argv) => {
    if (argv.includes(SETTINGS_FLAG)) settingsWindow.open()
  }
  openSettingsFromArgs(process.argv)

  app.on('before-quit', () => {
    store.flush()
    care.flush()
  })
  win.on('closed', () => {
    motion.dispose()
    userIdle.dispose()
    fullscreen.dispose()
    care.dispose()
    unregister()
    petWindow = null
  })
}

// FR-13: only one instance per machine.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  lockDownWebContents()

  app.on('second-instance', (_event, argv) => {
    petWindow?.showInactive()
    openSettingsFromArgs(argv)
  })

  void app.whenReady().then(start)

  // Only fires once the pet window is gone too (a hidden pet window still counts as open).
  app.on('window-all-closed', () => {
    tray?.destroy()
    tray = null
    app.quit()
  })
}
