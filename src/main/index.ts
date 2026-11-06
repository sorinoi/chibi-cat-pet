import { app, dialog, type Tray } from 'electron'
import { join } from 'node:path'
import { createAppActions } from './appActions'
import { createCareEngine, type CareSnapshot } from './careEngine'
import { applySettings } from './applySettings'
import { PET_FILE, STORE } from './config'
import { registerIpcHandlers, type CareUi } from './ipc'
import { createTray, showPetContextMenu } from './menus'
import { createPetMotion } from './petMotion'
import { createPetWindow } from './petWindow'
import { lockDownWebContents } from './security'
import { createSettingsStore } from './settingsStore'
import { createAdoptWindowManager, createSettingsWindowManager } from './settingsWindow'
import { watchFullscreen } from './fullscreenWatcher'
import { watchUserIdle } from './userIdle'
import { IpcChannel, type CareRequest, type CareView } from '../shared/ipc'
import { careSummary } from '../shared/careText'
import { STRINGS } from '../shared/strings'

const SECONDS_PER_MINUTE = 60

// Dev runs get their own data folder so they never touch the installed app's settings.
// Must run before the single-instance lock, which lives in userData.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')}-dev`)

// Keep a reference so the tray icon is not garbage collected.
let tray: Tray | null = null

/** `"Desktop Pet.exe" --settings` opens the settings window (also when already running). */
const SETTINGS_FLAG = '--settings'
let onSecondInstance: (argv: readonly string[]) => void = () => {}

const toView = (s: CareSnapshot | null): CareView | null =>
  s && { name: s.name, needs: s.needs, mood: s.mood, adoptedAt: s.adoptedAt }

function start(): void {
  const store = createSettingsStore(
    join(app.getPath('userData'), STORE.fileName),
    STORE.saveDebounceMs
  )
  const settingsWindow = createSettingsWindowManager()
  const adoptWindow = createAdoptWindowManager()

  // v2 pet care (requirement-v2.md sections 4 and 11). Inactive until a pet is adopted.
  const care = createCareEngine({ filePath: join(app.getPath('userData'), PET_FILE) })
  care.load()
  care.start()
  const hasPet = (): boolean => care.current() !== null

  // FR-22: no cat on the desktop until one is adopted.
  const win = createPetWindow(
    { version: 1, settings: store.settings, position: store.position },
    hasPet()
  )
  const sendToPet = (channel: string, payload?: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  const motion = createPetMotion(win, store.settings.petSize, {
    onWalkEnded: (event) => sendToPet(IpcChannel.PetWalkEnded, event),
    onSettled: (position) => store.setPosition(position) // FR-04
  })

  /** Care status everywhere it is shown: pet (mood, tooltip), settings, tray (FR-27, FR-28). */
  const publishCare = (): void => {
    const view = toView(care.current())
    sendToPet(IpcChannel.CareState, view)
    settingsWindow.get()?.webContents.send(IpcChannel.CareChanged, view)
    tray?.setToolTip(`${STRINGS.tray.tooltip}\n${careSummary(view)}`)
  }
  care.onChange(publishCare)
  win.webContents.on('did-finish-load', publishCare)

  /**
   * Menu care actions are requests: the pet renderer knows whether the cat can react right
   * now (a care action during another care animation is ignored) and applies it via care:act.
   */
  const request = (action: CareRequest): void => {
    if (!hasPet()) return
    if (!win.isDestroyed() && !win.isVisible()) win.showInactive()
    sendToPet(IpcChannel.CareRequest, action)
  }

  const careUi: CareUi = {
    view: () => toView(care.current()),
    adopt(name) {
      if (hasPet()) return false
      try {
        care.adopt(name)
      } catch {
        return false
      }
      adoptWindow.close()
      // FR-23: the cat appears where it was last and plays the welcome scene.
      win.showInactive()
      sendToPet(IpcChannel.CareRequest, 'welcome' satisfies CareRequest)
      return true
    },
    rename: (name) => toView(care.rename(name)),
    async adoptNew() {
      const parent = settingsWindow.get()
      const t = STRINGS.readopt
      const options = {
        type: 'warning' as const,
        title: STRINGS.appName,
        message: t.message,
        detail: t.detail,
        buttons: [t.cancel, t.confirm],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      }
      const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options)
      if (response !== 1) return false
      // FR-25/32: the old cat and its data are gone immediately.
      motion.stopWalk()
      motion.endDrag()
      care.wipe()
      win.hide()
      adoptWindow.open()
      return true
    },
    openAdopt: () => adoptWindow.open()
  }

  const actions = createAppActions(
    () => (win.isDestroyed() ? null : win),
    () => settingsWindow.open(),
    () => motion.stopWalk(),
    {
      hasPet,
      feed: () => request('feed'),
      pet: () => request('pet'),
      openAdopt: careUi.openAdopt,
      openPetStatus: () => settingsWindow.open()
    }
  )

  const unregister = registerIpcHandlers({
    petWindow: win,
    getSettingsWindow: settingsWindow.get,
    getAdoptWindow: adoptWindow.get,
    motion,
    store,
    care,
    careUi,
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
      if (hasPet()) win.showInactive()
    }
  })

  applySettings(win, motion, store.settings, null)
  store.onChange((next, previous) => {
    applySettings(win, motion, next, previous)
    settingsWindow.get()?.webContents.send(IpcChannel.SettingsChanged, next)
  })

  tray = createTray(actions)
  publishCare()

  onSecondInstance = (argv) => {
    if (argv.includes(SETTINGS_FLAG)) settingsWindow.open()
    else actions.showPet() // shows the pet, or opens adoption when there is none
  }
  if (process.argv.includes(SETTINGS_FLAG)) settingsWindow.open()
  // FR-22: first launch without a pet (new install or upgrade from v1).
  if (!hasPet()) adoptWindow.open()

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
  })
}

// FR-13: only one instance per machine.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  lockDownWebContents()

  app.on('second-instance', (_event, argv) => onSecondInstance(argv))

  void app.whenReady().then(start)

  // Only fires once the pet window is gone too (a hidden pet window still counts as open).
  app.on('window-all-closed', () => {
    tray?.destroy()
    tray = null
    app.quit()
  })
}
