import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { initialPosition, petWindowSize } from './petMotion'
import { loadRenderer } from './renderer'
import type { PersistedState } from '../shared/settings'

export function createPetWindow({ settings, position }: PersistedState): BrowserWindow {
  const size = petWindowSize(settings.petSize)
  const { x, y } = initialPosition(settings.petSize, position)

  const win = new BrowserWindow({
    x,
    y,
    ...size,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    title: 'Desktop Pet',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.setOpacity(settings.opacity)
  // Start fully click-through; the renderer turns mouse input on only over the model.
  win.setIgnoreMouseEvents(true, { forward: true })
  win.once('ready-to-show', () => win.showInactive())

  loadRenderer(win, 'index.html')
  return win
}
