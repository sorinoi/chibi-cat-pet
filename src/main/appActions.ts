import { app, dialog, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { RESOURCES } from './config'
import type { Strings } from '../shared/strings'

/** Actions shared by the tray menu and the pet's right-click menu. */
export interface AppActions extends CareActions {
  /** UI text in the current language (FR-43). */
  text(): Strings
  isPetVisible(): boolean
  /** Shows the pet, or opens adoption when there is none yet (FR-22). */
  showPet(): void
  hidePet(): void
  openSettings(): void
  showAbout(): void
  quit(): void
}

export interface CareActions {
  /** v2 care: false until a pet is adopted, so the menus offer Adopt instead of care. */
  hasPet(): boolean
  /** FR-17. */
  feed(): void
  /** FR-19. */
  pet(): void
  /** FR-22. */
  openAdopt(): void
  /** FR-28: opens settings, whose first section is the pet. */
  openPetStatus(): void
}

export function resourcePath(relative: string): string {
  return join(app.getAppPath(), relative)
}

export function createAppActions(
  getPetWindow: () => BrowserWindow | null,
  openSettings: () => void,
  onPetHidden: () => void,
  care: CareActions,
  text: () => Strings
): AppActions {
  return {
    ...care,
    text,
    isPetVisible() {
      return getPetWindow()?.isVisible() ?? false
    },
    showPet() {
      if (!care.hasPet()) {
        care.openAdopt()
        return
      }
      getPetWindow()?.showInactive()
    },
    hidePet() {
      onPetHidden()
      getPetWindow()?.hide()
    },
    openSettings,
    showAbout() {
      const t = text()
      void dialog.showMessageBox({
        type: 'info',
        title: t.about.title,
        message: t.appName,
        detail: t.about.detail(app.getVersion()),
        icon: nativeImage.createFromPath(resourcePath(RESOURCES.appIcon)),
        buttons: [t.about.ok]
      })
    },
    quit() {
      app.quit()
    }
  }
}
