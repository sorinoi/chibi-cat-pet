import { BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { RESOURCES, SETTINGS_WINDOW } from './config'
import { resourcePath } from './appActions'
import { loadRenderer } from './renderer'
import { STRINGS } from '../shared/strings'

export interface SettingsWindowManager {
  open(): void
  get(): BrowserWindow | null
}

/** One settings window at a time; opening again focuses it. */
export function createSettingsWindowManager(): SettingsWindowManager {
  let win: BrowserWindow | null = null

  return {
    open() {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore()
        win.focus()
        return
      }
      win = new BrowserWindow({
        ...SETTINGS_WINDOW,
        title: STRINGS.settings.title,
        icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon)),
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
          preload: join(__dirname, '../preload/settings.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          spellcheck: false
        }
      })
      win.setMenu(null)
      win.once('ready-to-show', () => win?.show())
      win.on('closed', () => {
        win = null
      })
      loadRenderer(win, 'settings.html')
    },
    get() {
      return win && !win.isDestroyed() ? win : null
    }
  }
}
