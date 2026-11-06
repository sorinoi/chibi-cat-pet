import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { initialPosition, petWindowSize } from './petMotion'
import { loadRenderer } from './renderer'
import type { PersistedState } from '../shared/settings'

/**
 * The pet window. `showWhenReady` is false until a pet is adopted (FR-22: no cat on the
 * desktop before adoption); main shows it after adopting.
 */
export function createPetWindow(
  { settings, position }: PersistedState,
  showWhenReady: boolean
): BrowserWindow {
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
  win.once('ready-to-show', () => {
    // hide() even though it was never shown, so the page reports itself hidden and pauses.
    if (showWhenReady) win.showInactive()
    else win.hide()
  })

  loadRenderer(win, 'index.html')
  return win
}
