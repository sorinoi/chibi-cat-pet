import { Notification, app, dialog, nativeImage, powerMonitor, screen, type Tray } from 'electron'
import { join } from 'node:path'
import { createAppActions, resourcePath } from './appActions'
import { createCareEngine, type CareSnapshot } from './careEngine'
import { applySettings } from './applySettings'
import { APP_USER_MODEL_ID, FOCUS_FILE, PET_FILE, RESOURCES, STORE, WALL } from './config'
import { createFocusEngine, toFocusView } from './focusEngine'
import { createCursorWatcher } from './cursorWatcher'
import { registerIpcHandlers, type CareUi } from './ipc'
import { createTray, showPetContextMenu } from './menus'
import { createPetMotion } from './petMotion'
import { createPetWindow } from './petWindow'
import { createWindowList } from './windowList'
import { ACTIVE_MODEL } from '../shared/activeModel'
import { lockDownWebContents } from './security'
import { createSettingsStore } from './settingsStore'
import { createAdoptWindowManager, createSettingsWindowManager } from './settingsWindow'
import { watchFullscreen } from './fullscreenWatcher'
import { watchUserIdle } from './userIdle'
import { IpcChannel, type CareRequest, type CareView } from '../shared/ipc'
import { careSummary } from '../shared/careText'
import { focusNotice, focusReaction, focusStatus } from '../shared/focusText'
import type { TimerEvent } from '../shared/focusTimer'
import { shouldShowHungerNotice } from '../shared/hungerNotice'
import { CARE } from '../shared/careConfig'
import { sleepAfterSeconds } from '../shared/timeOfDay'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { languageForLocales, stringsFor, type Strings } from '../shared/strings'

// Dev runs get their own data folder so they never touch the installed app's settings.
// Must run before the single-instance lock, which lives in userData.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')}-dev`)

// Keep a reference so the tray icon is not garbage collected.
let tray: Tray | null = null

/** `"Desktop Pet.exe" --settings` opens the settings window (also when already running). */
const SETTINGS_FLAG = '--settings'
let onSecondInstance: (argv: readonly string[]) => void = () => {}

const toView = (s: CareSnapshot | null): CareView | null =>
  s && { name: s.name, needs: s.needs, mood: s.mood, adoptedAt: s.adoptedAt, treats: s.treats }

function start(): void {
  // FR-42/45: without a saved language, follow the Windows display language.
  const store = createSettingsStore(
    join(app.getPath('userData'), STORE.fileName),
    STORE.saveDebounceMs,
    { ...DEFAULT_SETTINGS, language: languageForLocales(app.getPreferredSystemLanguages()) }
  )
  const text = (): Strings => stringsFor(store.settings.language)
  const settingsWindow = createSettingsWindowManager(text)
  const adoptWindow = createAdoptWindowManager(text)

  // v2 pet care (requirement-v2.md sections 4 and 11). Inactive until a pet is adopted.
  const care = createCareEngine({ filePath: join(app.getPath('userData'), PET_FILE) })
  care.load()
  care.start()

  // v3 focus timer (requirement-v3.md section 4). Menus and notifications come in V3-M3.
  const focus = createFocusEngine({
    filePath: join(app.getPath('userData'), FOCUS_FILE),
    settings: () => store.settings
  })
  focus.load()
  // A focus the PC slept through is interrupted right on wake, not at the next tick.
  const onResume = (): void => focus.check()
  powerMonitor.on('resume', onResume)
  const hasPet = (): boolean => care.current() !== null

  // FR-22: no cat on the desktop until one is adopted.
  const win = createPetWindow(
    { version: 1, settings: store.settings, position: store.position },
    hasPet()
  )
  const sendToPet = (channel: string, payload?: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  const windowList = createWindowList()
  const motion = createPetMotion(
    win,
    store.settings.petSize,
    {
      onWalkEnded: (event) => sendToPet(IpcChannel.PetWalkEnded, event),
      onSettled: (position) => store.setPosition(position), // FR-04, FR-63
      onFallStart: () => sendToPet(IpcChannel.PetFallStart),
      onLanded: () => sendToPet(IpcChannel.PetLanded),
      onClimbPhase: (phase) => sendToPet(IpcChannel.PetClimbPhase, phase)
    },
    {
      gravity: () => store.settings.gravity,
      // FR-71, FR-72: other apps' windows, read only when a fall starts.
      windows: () => (store.settings.sitOnWindows ? windowList.list() : []),
      inspectWindow: (id, probe) => windowList.inspect(id, probe),
      // FR-78: only with the setting on and the art present.
      jumps: () => store.settings.jumpAndClimb && ACTIVE_MODEL.clips.jump !== undefined,
      climbs: () => store.settings.jumpAndClimb && WALL.climb !== null
    }
  )

  /**
   * requirement-v5.md FR-63: a visible cat at rest in the air falls once (start, shown again,
   * displays changed, Gravity turned on). Only once the page can hear about it.
   */
  let petPageReady = false
  const settlePet = (): void => {
    if (petPageReady && !win.isDestroyed() && win.isVisible() && hasPet()) motion.settle()
  }
  win.webContents.on('did-start-loading', () => {
    petPageReady = false
  })
  win.webContents.on('did-finish-load', () => {
    petPageReady = true
    settlePet()
  })
  win.on('show', settlePet)
  const onDisplaysChanged = (): void => settlePet()
  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)

  /** Care status everywhere it is shown: pet (mood, tooltip), settings, tray (FR-27, FR-28). */
  const publishCare = (): void => {
    const view = toView(care.current())
    sendToPet(IpcChannel.CareState, view)
    settingsWindow.get()?.webContents.send(IpcChannel.CareChanged, view)
    updateTrayTooltip()
  }
  care.onChange(publishCare)
  win.webContents.on('did-finish-load', publishCare)

  /** FR-28 + FR-36: app name, the cat's status and the timer's status. */
  function updateTrayTooltip(): void {
    const t = text()
    const lines = [
      t.tray.tooltip,
      careSummary(toView(care.current()), t),
      focusStatus(toFocusView(focus.current()), t)
    ]
    tray?.setToolTip(lines.join('\n'))
  }

  /** Timer status everywhere it is shown; notifications and reactions at phase changes. */
  const publishFocus = (events: readonly TimerEvent[]): void => {
    const view = toFocusView(focus.current())
    sendToPet(IpcChannel.FocusState, view)
    settingsWindow.get()?.webContents.send(IpcChannel.FocusState, view)
    updateTrayTooltip()
    if (events.length === 0) return
    // FR-38: the pet renderer decides whether the cat can react (drag, hidden, busy).
    const reaction = focusReaction(events)
    if (reaction && hasPet()) sendToPet(IpcChannel.FocusReaction, reaction)
    // FR-37: Windows notification, unless turned off.
    // FR-51: completed focus sessions earn treats when the setting is on and there is a cat.
    const completed = events.filter((e) => e.type === 'focusCompleted').length
    const earned =
      completed > 0 && store.settings.focusTreats
        ? (care.earnTreats(completed * CARE.treats.perFocus) ?? 0)
        : 0
    const notice = focusNotice(events, view, store.settings, text(), earned)
    if (notice && store.settings.focusNotifications && Notification.isSupported()) {
      new Notification({
        title: notice.title,
        body: notice.body,
        icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon))
      }).show()
    }
  }
  focus.onChange((_snapshot, events) => publishFocus(events))
  win.webContents.on('did-finish-load', () => publishFocus([]))

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
      const t = text().readopt
      const options = {
        type: 'warning' as const,
        title: text().appName,
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
      motion.stopFall()
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
    () => {
      motion.stopWalk()
      motion.stopFall() // resumes when shown again (FR-63)
    },
    {
      hasPet,
      feed: () => request('feed'),
      pet: () => request('pet'),
      openAdopt: careUi.openAdopt,
      openPetStatus: () => settingsWindow.open(),
      treats: () => (store.settings.focusTreats ? (care.current()?.treats ?? 0) : 0),
      giveTreat: () => request('treat')
    },
    text,
    focus
  )

  // FR-56/57: cursor updates for looking, only while the pet asks and is visible.
  const cursor = createCursorWatcher(
    win,
    (position) => sendToPet(IpcChannel.PetCursor, position),
    CARE.look.pollMs
  )

  const unregister = registerIpcHandlers({
    petWindow: win,
    getSettingsWindow: settingsWindow.get,
    getAdoptWindow: adoptWindow.get,
    motion,
    store,
    care,
    careUi,
    focus,
    showContextMenu: () => showPetContextMenu(win, actions),
    setLookWatch: (on) => cursor.setWatching(on)
  })

  const userIdle = watchUserIdle(
    // FR-59 (requirement-v4.md): sleepier at night.
    () => sleepAfterSeconds(store.settings.sleepAfterMinutes, Date.now()),
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
      motion.stopFall()
      win.hide()
    } else if (!isFullscreen && hiddenForFullscreen) {
      hiddenForFullscreen = false
      if (hasPet()) win.showInactive()
    }
  })

  // FR-46/47 (requirement-v4.md): optional reminder when the cat is hungry, checked on every
  // care update (once a minute). It waits while the user is away or a fullscreen app runs.
  let lastHungerNoticeAt: number | null = null
  care.onChange((snapshot) => {
    const now = Date.now()
    const show = shouldShowHungerNotice({
      enabled: store.settings.hungerReminder,
      hunger: snapshot ? snapshot.needs.hunger : null,
      lastShownAt: lastHungerNoticeAt,
      userBusy: userIdle.idle || hiddenForFullscreen,
      now
    })
    if (!show || !snapshot || !Notification.isSupported()) return
    lastHungerNoticeAt = now
    const t = text().care
    new Notification({
      title: t.hungryNoticeTitle(snapshot.name),
      body: t.hungryNoticeBody,
      icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon))
    }).show()
  })

  applySettings(win, motion, store.settings, null)
  store.onChange((next, previous) => {
    applySettings(win, motion, next, previous)
    settingsWindow.get()?.webContents.send(IpcChannel.SettingsChanged, next)
    // FR-64: turning Gravity on drops a cat that was left in the air; FR-71: turning Sit on
    // windows off drops a cat sitting on one (on: it may now stay where it lands next).
    if (
      (next.gravity && !previous.gravity) ||
      (next.sitOnWindows !== previous.sitOnWindows && next.gravity)
    )
      settlePet()
    if (next.language !== previous.language) {
      // FR-44: open windows switch at once; menus and dialogs read the language when shown.
      sendToPet(IpcChannel.AppLanguageChanged, next.language)
      adoptWindow.get()?.webContents.send(IpcChannel.AppLanguageChanged, next.language)
      publishCare()
    }
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
    powerMonitor.off('resume', onResume)
    focus.dispose()
    cursor.dispose()
    screen.off('display-added', onDisplaysChanged)
    screen.off('display-removed', onDisplaysChanged)
    screen.off('display-metrics-changed', onDisplaysChanged)
    unregister()
  })
}

// FR-13: only one instance per machine.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  lockDownWebContents()
  // Windows shows notifications only for an app id that matches its Start menu shortcut,
  // which the installer creates with the appId (FR-37). Dev runs keep Electron's default.
  if (app.isPackaged) app.setAppUserModelId(APP_USER_MODEL_ID)

  app.on('second-instance', (_event, argv) => onSecondInstance(argv))

  void app.whenReady().then(start)

  // Only fires once the pet window is gone too (a hidden pet window still counts as open).
  app.on('window-all-closed', () => {
    tray?.destroy()
    tray = null
    app.quit()
  })
}
