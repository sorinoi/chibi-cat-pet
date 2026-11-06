import { BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { ADOPT_WINDOW, RESOURCES, SETTINGS_WINDOW } from './config'
import { resourcePath } from './appActions'
import { loadRenderer, type RendererPage } from './renderer'
import { STRINGS } from '../shared/strings'

export interface ToolWindowManager {
  open(): void
  close(): void
  get(): BrowserWindow | null
}

interface ToolWindowOptions {
  page: RendererPage
  /** Preload file name in out/preload (each window gets only the API it needs). */
  preload: string
  title: string
  size: { width: number; height: number }
}

/** One window of this kind at a time; opening it again focuses the existing one. */
function createToolWindowManager(options: ToolWindowOptions): ToolWindowManager {
  let win: BrowserWindow | null = null
  const alive = (): BrowserWindow | null => (win && !win.isDestroyed() ? win : null)

  return {
    open() {
      const existing = alive()
      if (existing) {
        if (existing.isMinimized()) existing.restore()
        existing.focus()
        return
      }
      const created = new BrowserWindow({
        ...options.size,
        title: options.title,
        icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon)),
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
          preload: join(__dirname, '../preload', options.preload),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          spellcheck: false
        }
      })
      win = created
      created.setMenu(null)
      created.once('ready-to-show', () => created.show())
      created.on('closed', () => {
        if (win === created) win = null
      })
      loadRenderer(created, options.page)
    },
    close() {
      alive()?.close()
    },
    get: alive
  }
}

export function createSettingsWindowManager(): ToolWindowManager {
  return createToolWindowManager({
    page: 'settings.html',
    preload: 'settings.js',
    title: STRINGS.settings.title,
    size: SETTINGS_WINDOW
  })
}

/** FR-22: the adoption window. */
export function createAdoptWindowManager(): ToolWindowManager {
  return createToolWindowManager({
    page: 'adopt.html',
    preload: 'adopt.js',
    title: STRINGS.adopt.title,
    size: ADOPT_WINDOW
  })
}
