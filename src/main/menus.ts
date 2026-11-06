import {
  Menu,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { RESOURCES } from './config'
import { resourcePath, type AppActions } from './appActions'
import { STRINGS } from '../shared/strings'

const separator: MenuItemConstructorOptions = { type: 'separator' }

/**
 * FR-09 / FR-28: tray icon. With a pet: Feed, show/hide, pet status, settings, about, quit.
 * Before adoption: Adopt, settings, about, quit. Left click toggles the pet (or adopts).
 */
export function createTray(actions: AppActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(resourcePath(RESOURCES.trayIcon)))
  tray.setToolTip(STRINGS.tray.tooltip)

  const common: MenuItemConstructorOptions[] = [
    { label: STRINGS.tray.settings, click: actions.openSettings },
    { label: STRINGS.tray.about, click: actions.showAbout },
    separator,
    { label: STRINGS.tray.quit, click: actions.quit }
  ]

  const buildMenu = (): Menu =>
    Menu.buildFromTemplate(
      actions.hasPet()
        ? [
            { label: STRINGS.tray.feed, click: actions.feed },
            separator,
            actions.isPetVisible()
              ? { label: STRINGS.tray.hide, click: actions.hidePet }
              : { label: STRINGS.tray.show, click: actions.showPet },
            { label: STRINGS.tray.petStatus, click: actions.openPetStatus },
            ...common
          ]
        : [{ label: STRINGS.tray.adopt, click: actions.openAdopt }, separator, ...common]
    )

  // Rebuild on open so labels always match the current state.
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()))
  tray.on('click', () => (actions.isPetVisible() ? actions.hidePet() : actions.showPet()))
  return tray
}

/** FR-10: right-click menu on the pet itself (only reachable once a pet is adopted). */
export function showPetContextMenu(win: BrowserWindow, actions: AppActions): void {
  // Windows only keeps a popup menu open while its owner is the foreground window.
  win.focus()
  const care: MenuItemConstructorOptions[] = actions.hasPet()
    ? [
        { label: STRINGS.contextMenu.feed, click: actions.feed },
        { label: STRINGS.contextMenu.pet, click: actions.pet },
        separator
      ]
    : []
  Menu.buildFromTemplate([
    ...care,
    { label: STRINGS.contextMenu.hide, click: actions.hidePet },
    { label: STRINGS.contextMenu.settings, click: actions.openSettings },
    separator,
    { label: STRINGS.contextMenu.quit, click: actions.quit }
  ]).popup({ window: win })
}
