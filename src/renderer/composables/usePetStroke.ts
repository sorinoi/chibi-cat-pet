import { onBeforeUnmount, onMounted } from 'vue'
import { createStrokeDetector } from '../lib/strokeDetector'

/**
 * FR-18: recognizes petting by moving the cursor back and forth over the cat without
 * pressing. Uses window mousemove, which Electron forwards even while the window lets the
 * mouse pass through, so stroking works without a click.
 */
export function usePetStroke(
  hitTest: (x: number, y: number) => boolean,
  onStroke: () => void
): void {
  const detector = createStrokeDetector()

  const onMove = (e: MouseEvent): void => {
    const recognized = detector.push({
      x: e.screenX,
      t: e.timeStamp,
      overPet: hitTest(e.clientX, e.clientY),
      pressed: e.buttons !== 0
    })
    if (recognized) onStroke()
  }
  const onLeave = (): void => detector.reset()

  onMounted(() => {
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMove)
    document.documentElement.removeEventListener('mouseleave', onLeave)
  })
}
