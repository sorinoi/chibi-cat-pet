import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron'
import { RESOURCES } from './config'
import { resourcePath, type AppActions } from './appActions'
import { STRINGS } from '../shared/strings'

/** FR-09: tray icon with show/hide, settings, about, quit. Left click toggles the pet. */
export function createTray(actions: AppActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(resourcePath(RESOURCES.trayIcon)))
  tray.setToolTip(STRINGS.tray.tooltip)

  const buildMenu = (): Menu =>
    Menu.buildFromTemplate([
      actions.isPetVisible()
        ? { label: STRINGS.tray.hide, click: actions.hidePet }
        : { label: STRINGS.tray.show, click: actions.showPet },
      { label: STRINGS.tray.settings, click: actions.openSettings },
      { label: STRINGS.tray.about, click: actions.showAbout },
      { type: 'separator' },
      { label: STRINGS.tray.quit, click: actions.quit }
    ])

  // Rebuild on open so the show/hide label is always current.
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()))
  tray.on('click', () => (actions.isPetVisible() ? actions.hidePet() : actions.showPet()))
  return tray
}

/** FR-10: right-click menu on the pet itself. */
export function showPetContextMenu(win: BrowserWindow, actions: AppActions): void {
  // Windows only keeps a popup menu open while its owner is the foreground window.
  win.focus()
  Menu.buildFromTemplate([
    { label: STRINGS.contextMenu.hide, click: actions.hidePet },
    { label: STRINGS.contextMenu.settings, click: actions.openSettings },
    { type: 'separator' },
    { label: STRINGS.contextMenu.quit, click: actions.quit }
  ]).popup({ window: win })
}
