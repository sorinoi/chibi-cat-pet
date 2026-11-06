import {
  Menu,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { RESOURCES } from './config'
import { resourcePath, type AppActions } from './appActions'
import { toFocusView } from './focusEngine'
import { focusStatus } from '../shared/focusText'

const separator: MenuItemConstructorOptions = { type: 'separator' }

/**
 * FR-35: the Focus submenu. A status line, then only the actions that apply now.
 */
function focusMenu(actions: AppActions): MenuItemConstructorOptions {
  const text = actions.text()
  const t = text.focus
  const { focus } = actions
  const view = toFocusView(focus.current())
  const items: MenuItemConstructorOptions[] = [
    { label: focusStatus(view, text), enabled: false },
    separator
  ]
  switch (view.kind) {
    case 'idle':
      items.push({ label: t.startFocus, click: () => focus.startFocus() })
      break
    case 'running':
      items.push(
        { label: t.pause, click: () => focus.pause() },
        { label: t.skip, click: () => focus.skip() },
        { label: t.stop, click: () => focus.stop() }
      )
      break
    case 'paused':
      items.push(
        { label: t.resume, click: () => focus.resume() },
        { label: t.skip, click: () => focus.skip() },
        { label: t.stop, click: () => focus.stop() }
      )
      break
    case 'waiting':
      items.push(
        { label: t.startBreak, click: () => focus.startBreak() },
        { label: t.skipBreak, click: () => focus.skip() },
        { label: t.stop, click: () => focus.stop() }
      )
      break
  }
  return { label: t.menu, submenu: items }
}

/**
 * FR-09 / FR-28 / FR-35: tray icon. With a pet: Feed, Focus, show/hide, pet status, settings,
 * about, quit. Before adoption: Adopt, Focus, settings, about, quit. Left click toggles the pet (or adopts).
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
            focusMenu(actions),
            separator,
            actions.isPetVisible()
              ? { label: t.hide, click: actions.hidePet }
              : { label: t.show, click: actions.showPet },
            { label: t.petStatus, click: actions.openPetStatus },
            ...common
          ]
        : // The timer works without a cat too (requirement-v3.md section 5).
          [{ label: t.adopt, click: actions.openAdopt }, focusMenu(actions), separator, ...common]
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
    ? [
        { label: t.feed, click: actions.feed },
        { label: t.pet, click: actions.pet },
        focusMenu(actions),
        separator
      ]
    : []
  Menu.buildFromTemplate([
    ...care,
    { label: t.hide, click: actions.hidePet },
    { label: t.settings, click: actions.openSettings },
    separator,
    { label: t.quit, click: actions.quit }
  ]).popup({ window: win })
}
