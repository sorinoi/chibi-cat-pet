import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { ACTIONS } from './config'
import { loadRenderer } from './renderer'
import { layoutActionArc } from './lib/actionArc'
import { createActionsVisibility } from './lib/actionsVisibility'
import type { ActionsUi } from './ipc'
import { IpcChannel, type ActionId, type ActionsLayout, type ArtBox } from '../shared/ipc'
import type { ActionButton } from '../shared/quickActions'

export interface QuickActions extends ActionsUi {
  /** Redraw open buttons (the focus timer or the language changed, FR-129). */
  refresh(): void
  dispose(): void
}

export interface QuickActionsOptions {
  petSize(): number
  /** FR-134: the Settings switch. */
  enabled(): boolean
  /** The buttons to show now, left to right (FR-127..129). */
  buttons(): ActionButton[]
  /** FR-128..130: do what the button stands for (after the buttons are gone, FR-131). */
  run(id: ActionId): void
  /** The buttons are gone (tell the pet, FR-121). */
  onClosed(): void
}

/**
 * requirement-v9.md: the small window with the quick buttons. It is created hidden with the
 * pet (so it opens at once, NFR-51), owned by the pet window (always just above it), never
 * takes focus, and lets the mouse through except over a button (FR-126).
 */
export function createQuickActions(pet: BrowserWindow, options: QuickActionsOptions): QuickActions {
  const win = new BrowserWindow({
    parent: pet,
    width: 1,
    height: 1,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    title: 'Desktop Pet buttons',
    webPreferences: {
      preload: join(__dirname, '../preload/actions.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })
  win.setIgnoreMouseEvents(true, { forward: true })

  let pageReady = false
  win.webContents.on('did-start-loading', () => {
    pageReady = false
  })
  win.webContents.on('did-finish-load', () => {
    pageReady = true
  })
  loadRenderer(win, 'actions.html')

  /** The art the buttons are placed around, relative to the pet window (DIP). */
  let anchor: ArtBox | null = null
  const alive = (): boolean => !win.isDestroyed() && !pet.isDestroyed()

  const visibility = createActionsVisibility({
    hideDelayMs: ACTIONS.hideDelayMs,
    onHide: () => {
      anchor = null
      if (alive()) {
        win.hide()
        win.setIgnoreMouseEvents(true, { forward: true })
      }
      options.onClosed()
    }
  })

  /** FR-124, FR-125: lay the arc out around the cat as it is now and move the window there. */
  function place(): void {
    if (!anchor || !alive()) return
    const bounds = pet.getBounds()
    const head = { x: bounds.x + anchor.head.x, y: bounds.y + anchor.head.y }
    const feet = { x: bounds.x + anchor.feet.x, y: bounds.y + anchor.feet.y }
    const area = screen.getDisplayNearestPoint({
      x: Math.round(head.x),
      y: Math.round(feet.y)
    }).workArea
    const size = options.petSize()
    const buttonSize = Math.max(ACTIONS.minButtonSize, ACTIONS.buttonSize * size)
    const buttons = options.buttons()
    const arc = layoutActionArc({
      head,
      feet,
      area,
      count: buttons.length,
      buttonSize,
      radius: Math.max(ACTIONS.minRadius, ACTIONS.radius * size),
      spreadDeg: ACTIONS.spreadDeg,
      centreInset: ACTIONS.centreInset,
      edgeMargin: ACTIONS.edgeMargin,
      maxTurnDeg: ACTIONS.maxTurnDeg,
      turnStepDeg: ACTIONS.turnStepDeg,
      windowPad: ACTIONS.windowPad,
      labelRoom: ACTIONS.labelRoom
    })
    const layout: ActionsLayout = {
      size: buttonSize,
      side: arc.side,
      buttons: arc.buttons.map((b, i) => ({ ...buttons[i], x: b.x, y: b.y })),
      area: {
        x: area.x - arc.window.x,
        y: area.y - arc.window.y,
        width: area.width,
        height: area.height
      }
    }
    win.webContents.send(IpcChannel.ActionsLayout, layout)
    win.setBounds(arc.window)
  }

  // The pet window can move under open buttons (a perch moved, FR-122 keeps the cat itself
  // still); follow it. Hidden pet (tray, fullscreen app): hide the buttons (FR-121).
  const onPetMove = (): void => {
    if (visibility.isOpen()) place()
  }
  const onPetHide = (): void => visibility.close()
  pet.on('move', onPetMove)
  pet.on('hide', onPetHide)

  return {
    window: () => (win.isDestroyed() ? null : win),
    open(art) {
      if (!options.enabled() || !alive() || !pageReady || !pet.isVisible()) return false
      anchor = art
      place()
      win.setAlwaysOnTop(pet.isAlwaysOnTop(), 'pop-up-menu')
      win.showInactive()
      visibility.open()
      return true
    },
    pointer: (on, over) => visibility.setPointer(on, over),
    close: () => visibility.close(),
    setIgnoreMouse(ignore) {
      if (!alive()) return
      if (ignore) win.setIgnoreMouseEvents(true, { forward: true })
      else win.setIgnoreMouseEvents(false)
    },
    // FR-131: the buttons go first, so the cat's reaction is not covered.
    run(id) {
      if (!visibility.isOpen()) return
      visibility.close()
      options.run(id)
    },
    refresh() {
      if (visibility.isOpen()) place()
    },
    dispose() {
      visibility.dispose()
      if (!pet.isDestroyed()) {
        pet.off('move', onPetMove)
        pet.off('hide', onPetHide)
      }
      if (!win.isDestroyed()) win.destroy()
    }
  }
}
