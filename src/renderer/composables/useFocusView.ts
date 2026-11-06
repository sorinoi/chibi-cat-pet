import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { FocusView } from '../../shared/focusText'

/** Mirrors the focus timer state from main (FR-36, FR-39). null until loaded. */
export function useFocusView(
  get: () => Promise<FocusView>,
  subscribe: (listener: (view: FocusView) => void) => () => void
): Ref<FocusView | null> {
  const view = ref<FocusView | null>(null)
  let unsubscribe: (() => void) | null = null
  onMounted(async () => {
    unsubscribe = subscribe((next) => {
      view.value = next
    })
    view.value = await get()
  })
  onBeforeUnmount(() => unsubscribe?.())
  return view
}
