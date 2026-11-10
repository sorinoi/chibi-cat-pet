import { onBeforeUnmount, onMounted } from 'vue'
import { BEHAVIOR } from '../config'

/**
 * requirement-v9.md FR-120: notices the pointer resting on the cat. Every move farther than
 * restMoveDip starts the wait again, so stroking (FR-18) never counts as a rest. Uses window
 * mousemove, which Electron forwards while the window lets the mouse through. The timer runs
 * only while the pointer is on the cat (NFR-50).
 */
export function usePetRest(
  hitTest: (x: number, y: number) => boolean,
  canRest: () => boolean,
  onRest: () => void
): void {
  let anchor: { x: number; y: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel(): void {
    if (timer) clearTimeout(timer)
    timer = null
    anchor = null
  }

  const onMove = (e: MouseEvent): void => {
    if (e.buttons !== 0 || !canRest() || !hitTest(e.clientX, e.clientY)) {
      cancel()
      return
    }
    const { restMoveDip, restMs } = BEHAVIOR.actions
    if (anchor && Math.hypot(e.screenX - anchor.x, e.screenY - anchor.y) <= restMoveDip) return
    if (timer) clearTimeout(timer)
    anchor = { x: e.screenX, y: e.screenY }
    timer = setTimeout(() => {
      timer = null
      anchor = null
      if (canRest()) onRest()
    }, restMs)
  }

  onMounted(() => {
    window.addEventListener('mousemove', onMove)
    window.addEventListener('pointerdown', cancel)
    document.documentElement.addEventListener('mouseleave', cancel)
  })

  onBeforeUnmount(() => {
    cancel()
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('pointerdown', cancel)
    document.documentElement.removeEventListener('mouseleave', cancel)
  })
}
