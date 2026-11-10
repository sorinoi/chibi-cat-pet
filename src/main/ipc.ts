import {
  app,
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import {
  ACTION_IDS,
  IpcChannel,
  type ActionId,
  type ActivityTestResult,
  type ArtBox,
  type ActivityView,
  type CareAct,
  type CareView,
  type HopRequest,
  type SettingsSnapshot,
  type WalkRequest
} from '../shared/ipc'
import type { CareEngine } from './careEngine'
import type { PetMotion } from './petMotion'
import type { SettingsStore } from './settingsStore'
import { toFocusView, type FocusEngine } from './focusEngine'
import { canStartWithWindows } from './applySettings'

const isCareAct = (value: unknown): value is CareAct =>
  value === 'feed' || value === 'pet' || value === 'click' || value === 'treat'

/** requirement-v8.md FR-114: a hop run request (main clamps the numbers). */
function isHopRequest(value: unknown): value is HopRequest {
  if (typeof value !== 'object' || value === null) return false
  const { count, distance, roll } = value as Record<string, unknown>
  return (
    typeof count === 'number' &&
    Number.isFinite(count) &&
    typeof distance === 'number' &&
    Number.isFinite(distance) &&
    typeof roll === 'number' &&
    roll >= 0 &&
    roll <= 1
  )
}

const isPoint = (value: unknown): value is { x: number; y: number } => {
  if (typeof value !== 'object' || value === null) return false
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
}

/** requirement-v9.md FR-124: the cat's art box from the pet. */
function isArtBox(value: unknown): value is ArtBox {
  if (typeof value !== 'object' || value === null) return false
  const { head, feet } = value as Record<string, unknown>
  return isPoint(head) && isPoint(feet)
}

const isActionId = (value: unknown): value is ActionId =>
  typeof value === 'string' && (ACTION_IDS as readonly string[]).includes(value)

function isWalkRequest(value: unknown): value is WalkRequest {
  if (typeof value !== 'object' || value === null) return false
  const { dx, speed, roll } = value as Record<string, unknown>
  return (
    typeof dx === 'number' &&
    typeof speed === 'number' &&
    (roll === undefined || (typeof roll === 'number' && roll >= 0 && roll <= 1))
  )
}

export interface IpcContext {
  petWindow: BrowserWindow
  getSettingsWindow(): BrowserWindow | null
  motion: PetMotion
  store: SettingsStore
  care: CareEngine
  focus: FocusEngine
  showContextMenu(): void
  /** FR-57: start or stop cursor updates for the pet. */
  setLookWatch(on: boolean): void
  getAdoptWindow(): BrowserWindow | null
  /** Adoption, rename and re-adoption flows (they touch several windows, so main wires them). */
  careUi: CareUi
  /** requirement-v6.md FR-87, FR-88: the Settings activity log group. */
  activityUi: ActivityUi
  /** requirement-v9.md: the quick buttons around the cat. */
  actionsUi: ActionsUi
}

export interface ActionsUi {
  window(): BrowserWindow | null
  /** FR-120: show the buttons around this art; false when they cannot show now. */
  open(art: ArtBox): boolean
  /** FR-121: where the pointer is. */
  pointer(on: 'pet' | 'buttons', over: boolean): void
  close(): void
  /** FR-126: the buttons window lets the mouse through, or not. */
  setIgnoreMouse(ignore: boolean): void
  run(id: ActionId): void
}

export interface ActivityUi {
  view(): ActivityView
  setKey(key: string): boolean
  test(): Promise<ActivityTestResult>
  /** Confirm, then empty the outbox. */
  clear(): Promise<boolean>
}

export interface CareUi {
  view(): CareView | null
  /** FR-22/23: false when the name is not usable or a pet already exists. */
  adopt(name: string, look: unknown): boolean
  /** requirement-v7.md FR-107. */
  setLook(look: string): CareView | null
  rename(name: string): CareView | null
  /** FR-25: confirm, wipe, open adoption. */
  adoptNew(): Promise<boolean>
  openAdopt(): void
}

/** Registers all IPC handlers. Each channel accepts only the window it belongs to. */
export function registerIpcHandlers(ctx: IpcContext): () => void {
  const { petWindow: win, motion, store, care } = ctx
  const fromPet = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    !win.isDestroyed() && event.sender === win.webContents
  const fromSettings = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.sender === ctx.getSettingsWindow()?.webContents
  const fromAdopt = (event: IpcMainInvokeEvent): boolean =>
    event.sender === ctx.getAdoptWindow()?.webContents
  const { careUi } = ctx

  ipcMain.on(IpcChannel.WindowSetIgnoreMouse, (event, ignore: unknown) => {
    if (!fromPet(event) || typeof ignore !== 'boolean') return
    win.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on(IpcChannel.PetDragStart, (event) => {
    if (fromPet(event)) motion.startDrag()
  })
  ipcMain.on(IpcChannel.PetDragEnd, (event) => {
    // requirement-v5.md FR-60: a drop, not just the end of following the cursor.
    if (fromPet(event)) motion.drop()
  })
  ipcMain.on(IpcChannel.PetWalkStop, (event) => {
    if (fromPet(event)) motion.stopWalk()
  })
  ipcMain.on(IpcChannel.PetJumpStop, (event) => {
    if (fromPet(event)) motion.stopJump()
  })
  ipcMain.on(IpcChannel.PetClimbStop, (event) => {
    if (fromPet(event)) motion.stopClimb()
  })
  ipcMain.on(IpcChannel.PetHopStop, (event) => {
    if (fromPet(event)) motion.stopHops()
  })
  ipcMain.on(IpcChannel.PetLookWatch, (event, on: unknown) => {
    if (fromPet(event) && typeof on === 'boolean') ctx.setLookWatch(on)
  })
  ipcMain.on(IpcChannel.PetShowContextMenu, (event) => {
    if (fromPet(event)) ctx.showContextMenu()
  })
  ipcMain.handle(IpcChannel.PetWalkStart, (event, request: unknown) => {
    if (!fromPet(event) || !isWalkRequest(request)) return 0
    return motion.startWalk(request)
  })
  ipcMain.handle(IpcChannel.PetJumpStart, (event) => (fromPet(event) ? motion.startJump() : null))
  ipcMain.handle(IpcChannel.PetClimbStart, (event) => (fromPet(event) ? motion.startClimb() : null))
  ipcMain.handle(IpcChannel.PetHopStart, (event, request: unknown) =>
    fromPet(event) && isHopRequest(request) ? motion.startHops(request) : null
  )

  ipcMain.handle(IpcChannel.CareAct, (event, act: unknown) => {
    if (!fromPet(event) || !isCareAct(act)) return null
    if (act === 'feed') {
      const fed = care.feed()
      return fed && { counted: !fed.refused, refused: fed.refused }
    }
    if (act === 'treat') {
      const given = care.giveTreat()
      return given && { counted: true, refused: false, full: given.full }
    }
    const bonus = act === 'pet' ? care.pet() : care.click()
    return bonus && { counted: bonus.counted, refused: false }
  })

  ipcMain.handle(IpcChannel.CareAdopt, (event, name: unknown, look: unknown) => {
    if (!fromAdopt(event) || typeof name !== 'string') return false
    return careUi.adopt(name, look)
  })
  ipcMain.handle(IpcChannel.CareGet, (event) => (fromSettings(event) ? careUi.view() : null))
  ipcMain.handle(IpcChannel.CareRename, (event, name: unknown) => {
    if (!fromSettings(event) || typeof name !== 'string') return null
    return careUi.rename(name)
  })
  ipcMain.handle(IpcChannel.CareSetLook, (event, look: unknown) => {
    if (!fromSettings(event) || typeof look !== 'string') return null
    return careUi.setLook(look)
  })
  ipcMain.handle(IpcChannel.CareAdoptNew, (event) =>
    fromSettings(event) ? careUi.adoptNew() : false
  )
  ipcMain.on(IpcChannel.CareOpenAdopt, (event) => {
    if (fromSettings(event)) careUi.openAdopt()
  })

  // FR-43: the pet and adoption windows ask for the UI language (settings reads it itself).
  // requirement-v8.md FR-117: the pet asks how busy to be.
  ipcMain.handle(IpcChannel.PetGetActivity, (event) =>
    fromPet(event) ? store.settings.activity : 'normal'
  )
  ipcMain.handle(IpcChannel.AppGetLanguage, (event) =>
    fromPet(event) || fromAdopt(event) ? store.settings.language : 'en'
  )

  ipcMain.handle(IpcChannel.FocusGet, (event) =>
    fromPet(event) || fromSettings(event) ? toFocusView(ctx.focus.current()) : null
  )

  ipcMain.handle(IpcChannel.SettingsGet, (event): SettingsSnapshot | null => {
    if (!fromSettings(event)) return null
    return {
      settings: store.settings,
      appVersion: app.getVersion(),
      canStartWithWindows: canStartWithWindows()
    }
  })
  ipcMain.handle(IpcChannel.SettingsUpdate, (event, patch: unknown) => {
    if (!fromSettings(event)) return store.settings
    return store.update(patch)
  })

  const { actionsUi } = ctx
  const fromActions = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
    const win = actionsUi.window()
    return win !== null && event.sender === win.webContents
  }
  ipcMain.handle(IpcChannel.PetActionsOpen, (event, art: unknown) =>
    fromPet(event) && isArtBox(art) ? actionsUi.open(art) : false
  )
  ipcMain.on(IpcChannel.PetActionsPointer, (event, over: unknown) => {
    if (fromPet(event) && typeof over === 'boolean') actionsUi.pointer('pet', over)
  })
  ipcMain.on(IpcChannel.PetActionsClose, (event) => {
    if (fromPet(event)) actionsUi.close()
  })
  ipcMain.on(IpcChannel.ActionsSetIgnoreMouse, (event, ignore: unknown) => {
    if (fromActions(event) && typeof ignore === 'boolean') actionsUi.setIgnoreMouse(ignore)
  })
  ipcMain.on(IpcChannel.ActionsHover, (event, over: unknown) => {
    if (fromActions(event) && typeof over === 'boolean') actionsUi.pointer('buttons', over)
  })
  ipcMain.on(IpcChannel.ActionsRun, (event, id: unknown) => {
    if (fromActions(event) && isActionId(id)) actionsUi.run(id)
  })

  const { activityUi } = ctx
  ipcMain.handle(IpcChannel.ActivityGet, (event) =>
    fromSettings(event) ? activityUi.view() : null
  )
  ipcMain.handle(IpcChannel.ActivitySetKey, (event, key: unknown) =>
    fromSettings(event) && typeof key === 'string' ? activityUi.setKey(key) : false
  )
  ipcMain.handle(IpcChannel.ActivityTest, (event) =>
    fromSettings(event) ? activityUi.test() : null
  )
  ipcMain.handle(IpcChannel.ActivityClear, (event) =>
    fromSettings(event) ? activityUi.clear() : false
  )

  return () => {
    for (const channel of [
      IpcChannel.WindowSetIgnoreMouse,
      IpcChannel.PetDragStart,
      IpcChannel.PetDragEnd,
      IpcChannel.PetWalkStop,
      IpcChannel.PetJumpStop,
      IpcChannel.PetClimbStop,
      IpcChannel.PetHopStop,
      IpcChannel.PetShowContextMenu,
      IpcChannel.PetLookWatch,
      IpcChannel.CareOpenAdopt,
      IpcChannel.PetActionsPointer,
      IpcChannel.PetActionsClose,
      IpcChannel.ActionsSetIgnoreMouse,
      IpcChannel.ActionsHover,
      IpcChannel.ActionsRun
    ]) {
      ipcMain.removeAllListeners(channel)
    }
    for (const channel of [
      IpcChannel.PetWalkStart,
      IpcChannel.PetJumpStart,
      IpcChannel.PetClimbStart,
      IpcChannel.PetHopStart,
      IpcChannel.CareAct,
      IpcChannel.CareAdopt,
      IpcChannel.CareGet,
      IpcChannel.CareRename,
      IpcChannel.CareSetLook,
      IpcChannel.CareAdoptNew,
      IpcChannel.SettingsGet,
      IpcChannel.SettingsUpdate,
      IpcChannel.AppGetLanguage,
      IpcChannel.PetGetActivity,
      IpcChannel.FocusGet,
      IpcChannel.ActivityGet,
      IpcChannel.ActivitySetKey,
      IpcChannel.ActivityTest,
      IpcChannel.ActivityClear,
      IpcChannel.PetActionsOpen
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}
