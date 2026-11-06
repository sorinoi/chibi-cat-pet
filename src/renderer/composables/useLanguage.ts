import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watchEffect,
  type ComputedRef,
  type Ref
} from 'vue'
import type { LanguageApi } from '../../shared/ipc'
import { stringsFor, type Language, type Strings } from '../../shared/strings'

export interface UseLanguage {
  language: Ref<Language>
  /** UI text in the current language (FR-43); switches live (FR-44). */
  text: ComputedRef<Strings>
}

/** For windows that do not read the settings (pet, adoption): main pushes the language. */
export function useLanguage(api: LanguageApi): UseLanguage {
  // English until main answers, which happens before the first paint in practice.
  const language = ref<Language>('en')
  let unsubscribe: (() => void) | null = null

  onMounted(async () => {
    unsubscribe = api.onLanguageChanged((next) => {
      language.value = next
    })
    language.value = await api.getLanguage()
  })
  onBeforeUnmount(() => unsubscribe?.())

  return { language, text: computed(() => stringsFor(language.value)) }
}

/** Keeps the page language and window title in the current language. */
export function useDocumentLanguage(language: () => Language, title: () => string): void {
  watchEffect(() => {
    document.documentElement.lang = language()
    document.title = title()
  })
}
