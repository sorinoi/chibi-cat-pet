import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

/** Loads a renderer page from the Vite dev server in dev, or from the bundle when built. */
export function loadRenderer(win: BrowserWindow, page: 'index.html' | 'settings.html'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    // Dev only: surface renderer console output in the terminal.
    win.webContents.on('console-message', (details) => {
      console.log(`[${page}:${details.level}] ${details.message}`)
    })
    void win.loadURL(`${devUrl}/${page}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer', page))
  }
}
