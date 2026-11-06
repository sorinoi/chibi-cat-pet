import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { CareView } from '../../shared/ipc'

export interface UseCare {
  /** null when there is no pet; undefined until loaded. */
  pet: Ref<CareView | null | undefined>
  /** Resolves false when the name was not usable. */
  rename(name: string): Promise<boolean>
  adoptNew(): Promise<void>
  openAdopt(): void
}

/** Settings window view of the pet (FR-24). Main is the source of truth; this mirrors it. */
export function useCare(): UseCare {
  const api = window.settingsApi
  const pet = ref<CareView | null | undefined>(undefined)
  let unsubscribe: (() => void) | null = null

  onMounted(async () => {
    unsubscribe = api.onCareChanged((view) => {
      pet.value = view
    })
    pet.value = await api.getCare()
  })

  onBeforeUnmount(() => unsubscribe?.())

  return {
    pet,
    async rename(name) {
      const view = await api.renamePet(name)
      if (view) pet.value = view
      return view !== null
    },
    async adoptNew() {
      await api.adoptNew()
    },
    openAdopt: () => api.openAdopt()
  }
}
