import { app, type BrowserWindow } from 'electron'
import { LOGIN_ITEM_NAME } from './config'
import type { PetMotion } from './petMotion'
import type { Settings } from '../shared/settings'

/** Login items only make sense for the installed exe; in dev it would register electron.exe. */
export const canStartWithWindows = (): boolean => app.isPackaged

/** FR-12. The value name matches build/installer.nsh so uninstall removes it. */
export function applyLoginItem(startWithWindows: boolean): void {
  if (!canStartWithWindows()) return
  app.setLoginItemSettings({ openAtLogin: startWithWindows, name: LOGIN_ITEM_NAME })
}

/** Applies changed settings to the running app (FR-11, FR-12). */
export function applySettings(
  win: BrowserWindow,
  motion: PetMotion,
  next: Settings,
  previous: Settings | null
): void {
  if (win.isDestroyed()) return
  if (!previous || next.opacity !== previous.opacity) win.setOpacity(next.opacity)
  if (!previous || next.alwaysOnTop !== previous.alwaysOnTop) win.setAlwaysOnTop(next.alwaysOnTop)
  if (!previous || next.petSize !== previous.petSize) motion.setScale(next.petSize)
  if (!previous || next.startWithWindows !== previous.startWithWindows) {
    applyLoginItem(next.startWithWindows)
  }
}
