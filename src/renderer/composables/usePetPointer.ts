import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { BEHAVIOR } from '../config'
import type { ClickThrough } from './useClickThrough'

export interface PetPointerHandlers {
  hitTest(clientX: number, clientY: number): boolean
  onClick(): void
  onDragStart(): void
  onDragEnd(): void
  /** Right-click on the cat (FR-10). */
  onContextMenu(): void
}

/**
 * Turns pointer input on the pet into click / drag-start / drag-end.
 * A press that travels less than BEHAVIOR.dragThreshold before release is a click.
 */
export function usePetPointer(
  canvas: Ref<HTMLCanvasElement | null>,
  clickThrough: ClickThrough,
  handlers: PetPointerHandlers
): void {
  let press: { id: number; x: number; y: number } | null = null
  let dragging = false

  function finish(released: boolean): void {
    if (!press) return
    if (dragging) handlers.onDragEnd()
    else if (released) handlers.onClick()
    press = null
    dragging = false
    clickThrough.setLocked(false)
  }

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || press || !handlers.hitTest(e.clientX, e.clientY)) return
    press = { id: e.pointerId, x: e.screenX, y: e.screenY }
    clickThrough.setLocked(true)
    canvas.value?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent): void => {
    if (!press || dragging || e.pointerId !== press.id) return
    if (Math.hypot(e.screenX - press.x, e.screenY - press.y) < BEHAVIOR.dragThreshold) return
    dragging = true
    handlers.onDragStart()
  }

  const onUp = (e: PointerEvent): void => {
    if (press && e.pointerId === press.id) finish(true)
  }
  const onCancel = (): void => finish(false)
  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    if (!press && handlers.hitTest(e.clientX, e.clientY)) handlers.onContextMenu()
  }

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('lostpointercapture', onCancel)
    el.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('blur', onCancel)
  })

  onBeforeUnmount(() => {
    finish(false)
    const el = canvas.value
    el?.removeEventListener('pointerdown', onDown)
    el?.removeEventListener('pointermove', onMove)
    el?.removeEventListener('pointerup', onUp)
    el?.removeEventListener('pointercancel', onCancel)
    el?.removeEventListener('lostpointercapture', onCancel)
    el?.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('blur', onCancel)
  })
}
