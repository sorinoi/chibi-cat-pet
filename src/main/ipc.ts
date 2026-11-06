import {
  app,
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import {
  IpcChannel,
  type CareAct,
  type CareView,
  type SettingsSnapshot,
  type WalkRequest
} from '../shared/ipc'
import type { CareEngine } from './careEngine'
import type { PetMotion } from './petMotion'
import type { SettingsStore } from './settingsStore'
import { canStartWithWindows } from './applySettings'

const isCareAct = (value: unknown): value is CareAct =>
  value === 'feed' || value === 'pet' || value === 'click'

function isWalkRequest(value: unknown): value is WalkRequest {
  if (typeof value !== 'object' || value === null) return false
  const { dx, speed } = value as Record<string, unknown>
  return typeof dx === 'number' && typeof speed === 'number'
}

export interface IpcContext {
  petWindow: BrowserWindow
  getSettingsWindow(): BrowserWindow | null
  motion: PetMotion
  store: SettingsStore
  care: CareEngine
  showContextMenu(): void
  getAdoptWindow(): BrowserWindow | null
  /** Adoption, rename and re-adoption flows (they touch several windows, so main wires them). */
  careUi: CareUi
}

export interface CareUi {
  view(): CareView | null
  /** FR-22/23: false when the name is not usable or a pet already exists. */
  adopt(name: string): boolean
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
    if (fromPet(event)) motion.endDrag()
  })
  ipcMain.on(IpcChannel.PetWalkStop, (event) => {
    if (fromPet(event)) motion.stopWalk()
  })
  ipcMain.on(IpcChannel.PetShowContextMenu, (event) => {
    if (fromPet(event)) ctx.showContextMenu()
  })
  ipcMain.handle(IpcChannel.PetWalkStart, (event, request: unknown) => {
    if (!fromPet(event) || !isWalkRequest(request)) return 0
    return motion.startWalk(request)
  })

  ipcMain.handle(IpcChannel.CareAct, (event, act: unknown) => {
    if (!fromPet(event) || !isCareAct(act)) return null
    if (act === 'feed') {
      const fed = care.feed()
      return fed && { counted: !fed.refused, refused: fed.refused }
    }
    const bonus = act === 'pet' ? care.pet() : care.click()
    return bonus && { counted: bonus.counted, refused: false }
  })

  ipcMain.handle(IpcChannel.CareAdopt, (event, name: unknown) => {
    if (!fromAdopt(event) || typeof name !== 'string') return false
    return careUi.adopt(name)
  })
  ipcMain.handle(IpcChannel.CareGet, (event) => (fromSettings(event) ? careUi.view() : null))
  ipcMain.handle(IpcChannel.CareRename, (event, name: unknown) => {
    if (!fromSettings(event) || typeof name !== 'string') return null
    return careUi.rename(name)
  })
  ipcMain.handle(IpcChannel.CareAdoptNew, (event) =>
    fromSettings(event) ? careUi.adoptNew() : false
  )
  ipcMain.on(IpcChannel.CareOpenAdopt, (event) => {
    if (fromSettings(event)) careUi.openAdopt()
  })

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

  return () => {
    for (const channel of [
      IpcChannel.WindowSetIgnoreMouse,
      IpcChannel.PetDragStart,
      IpcChannel.PetDragEnd,
      IpcChannel.PetWalkStop,
      IpcChannel.PetShowContextMenu,
      IpcChannel.CareOpenAdopt
    ]) {
      ipcMain.removeAllListeners(channel)
    }
    for (const channel of [
      IpcChannel.PetWalkStart,
      IpcChannel.CareAct,
      IpcChannel.CareAdopt,
      IpcChannel.CareGet,
      IpcChannel.CareRename,
      IpcChannel.CareAdoptNew,
      IpcChannel.SettingsGet,
      IpcChannel.SettingsUpdate
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}
