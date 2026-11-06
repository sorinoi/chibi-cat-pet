import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { createMouseIgnoreController } from '../lib/mouseIgnoreController'

export interface ClickThrough {
  overPet: Ref<boolean>
  /** While locked (press or drag in progress) the window keeps receiving the mouse. */
  setLocked(locked: boolean): void
  /** Re-test the last cursor position, for when the pet or the window moved under it. */
  recheck(): void
}

/**
 * FR-05: the window ignores the mouse except over the model.
 * With `forward: true`, Electron still delivers mousemove while ignoring,
 * so we hit test every move and flip the state only when it changes.
 */
export function useClickThrough(hitTest: (x: number, y: number) => boolean): ClickThrough {
  const overPet = ref(false)
  const controller = createMouseIgnoreController((ignore) =>
    window.petApi.setIgnoreMouseEvents(ignore)
  )
  let locked = false
  let lastScreen: { x: number; y: number } | null = null

  function update(over: boolean): void {
    controller.setOverPet(over)
    overPet.value = controller.overPet
  }

  const onMove = (e: MouseEvent): void => {
    lastScreen = { x: e.screenX, y: e.screenY }
    if (!locked) update(hitTest(e.clientX, e.clientY))
  }
  const onLeave = (): void => {
    lastScreen = null
    if (!locked) update(false)
  }

  function recheck(): void {
    // Only the "receiving" state can block the desktop, so only that needs re-testing.
    if (locked || !controller.overPet) return
    if (!lastScreen) {
      update(false)
      return
    }
    update(hitTest(lastScreen.x - window.screenX, lastScreen.y - window.screenY))
  }

  onMounted(() => {
    // Re-arm forwarding once the page exists. The main process sets it before load,
    // when Chromium's render widget window may not exist yet.
    window.petApi.setIgnoreMouseEvents(true)
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMove)
    document.documentElement.removeEventListener('mouseleave', onLeave)
    locked = false
    update(false)
  })

  return {
    overPet,
    setLocked(value) {
      locked = value
      if (value) update(true)
      else recheck()
    },
    recheck
  }
}
