import { app, dialog, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { RESOURCES } from './config'
import { STRINGS } from '../shared/strings'

/** Actions shared by the tray menu and the pet's right-click menu. */
export interface AppActions {
  isPetVisible(): boolean
  showPet(): void
  hidePet(): void
  openSettings(): void
  showAbout(): void
  quit(): void
  /** v2 care: false until a pet is adopted, so the menus hide Feed and Pet. */
  hasPet(): boolean
  /** FR-17. */
  feed(): void
  /** FR-19. */
  pet(): void
}

export interface CareActions {
  hasPet(): boolean
  feed(): void
  pet(): void
}

export function resourcePath(relative: string): string {
  return join(app.getAppPath(), relative)
}

export function createAppActions(
  getPetWindow: () => BrowserWindow | null,
  openSettings: () => void,
  onPetHidden: () => void,
  care: CareActions
): AppActions {
  return {
    ...care,
    isPetVisible() {
      return getPetWindow()?.isVisible() ?? false
    },
    showPet() {
      getPetWindow()?.showInactive()
    },
    hidePet() {
      onPetHidden()
      getPetWindow()?.hide()
    },
    openSettings,
    showAbout() {
      void dialog.showMessageBox({
        type: 'info',
        title: STRINGS.about.title,
        message: STRINGS.appName,
        detail: STRINGS.about.detail(app.getVersion()),
        icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon)),
        buttons: ['OK']
      })
    },
    quit() {
      app.quit()
    }
  }
}
