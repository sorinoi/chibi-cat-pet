import {
  Menu,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { RESOURCES } from './config'
import { resourcePath, type AppActions } from './appActions'

const separator: MenuItemConstructorOptions = { type: 'separator' }

/**
 * FR-09 / FR-28: tray icon. With a pet: Feed, show/hide, pet status, settings, about, quit.
 * Before adoption: Adopt, settings, about, quit. Left click toggles the pet (or adopts).
 */
export function createTray(actions: AppActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(resourcePath(RESOURCES.trayIcon)))
  tray.setToolTip(actions.text().tray.tooltip)

  // Built on every open, so labels follow the current state and language (FR-44).
  const buildMenu = (): Menu => {
    const t = actions.text().tray
    const common: MenuItemConstructorOptions[] = [
      { label: t.settings, click: actions.openSettings },
      { label: t.about, click: actions.showAbout },
      separator,
      { label: t.quit, click: actions.quit }
    ]
    return Menu.buildFromTemplate(
      actions.hasPet()
        ? [
            { label: t.feed, click: actions.feed },
            separator,
            actions.isPetVisible()
              ? { label: t.hide, click: actions.hidePet }
              : { label: t.show, click: actions.showPet },
            { label: t.petStatus, click: actions.openPetStatus },
            ...common
          ]
        : [{ label: t.adopt, click: actions.openAdopt }, separator, ...common]
    )
  }

  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()))
  tray.on('click', () => (actions.isPetVisible() ? actions.hidePet() : actions.showPet()))
  return tray
}

/** FR-10: right-click menu on the pet itself (only reachable once a pet is adopted). */
export function showPetContextMenu(win: BrowserWindow, actions: AppActions): void {
  // Windows only keeps a popup menu open while its owner is the foreground window.
  win.focus()
  const t = actions.text().contextMenu
  const care: MenuItemConstructorOptions[] = actions.hasPet()
    ? [{ label: t.feed, click: actions.feed }, { label: t.pet, click: actions.pet }, separator]
    : []
  Menu.buildFromTemplate([
    ...care,
    { label: t.hide, click: actions.hidePet },
    { label: t.settings, click: actions.openSettings },
    separator,
    { label: t.quit, click: actions.quit }
  ]).popup({ window: win })
}
