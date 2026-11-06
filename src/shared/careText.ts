/** Human-readable care status (FR-27, FR-28). Pure, shared by main (tray) and renderers. */
import type { Mood, Needs } from './needs'
import { STRINGS } from './strings'

export interface CareSummaryInput {
  name: string
  needs: Needs
  mood: Mood
}

export const percent = (value: number): number => Math.round(Math.min(100, Math.max(0, value)))

export function moodLabel(mood: Mood): string {
  return STRINGS.care.moods[mood]
}

/** "Mochi · Fed 72% · Happy 85% · Content", or "No cat yet". */
export function careSummary(pet: CareSummaryInput | null): string {
  if (!pet) return STRINGS.care.noPet
  const t = STRINGS.care
  return [
    pet.name,
    `${t.fed} ${percent(pet.needs.hunger)}%`,
    `${t.happy} ${percent(pet.needs.happiness)}%`,
    moodLabel(pet.mood)
  ].join(t.separator)
}
