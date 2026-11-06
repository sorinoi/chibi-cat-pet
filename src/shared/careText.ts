/** Human-readable care status (FR-27, FR-28). Pure, shared by main (tray) and renderers. */
import type { Mood, Needs } from './needs'
import type { Strings } from './strings'

export interface CareSummaryInput {
  name: string
  needs: Needs
  mood: Mood
}

export const percent = (value: number): number => Math.round(Math.min(100, Math.max(0, value)))

export function moodLabel(mood: Mood, text: Strings): string {
  return text.care.moods[mood]
}

/** "Mochi · Fed 72% · Happy 85% · Content", or "No cat yet", in the given language. */
export function careSummary(pet: CareSummaryInput | null, text: Strings): string {
  const t = text.care
  if (!pet) return t.noPet
  return [
    pet.name,
    `${t.fed} ${percent(pet.needs.hunger)}%`,
    `${t.happy} ${percent(pet.needs.happiness)}%`,
    moodLabel(pet.mood, text)
  ].join(t.separator)
}
