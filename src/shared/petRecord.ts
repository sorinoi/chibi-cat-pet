/** The adopted pet, as stored in pet.json (requirement-v2.md FR-30). Pure, unit tested. */
import { CARE, type CareConfig } from './careConfig'
import type { Needs } from './needs'

export const PET_SPECIES = ['cat'] as const
export type PetSpecies = (typeof PET_SPECIES)[number]

export interface PetRecord {
  version: 1
  name: string
  species: PetSpecies
  /** Epoch ms. */
  adoptedAt: number
  needs: Needs
  /** Epoch ms of the last needs update. */
  updatedAt: number
  counters: { feeds: number; pets: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clampNeed = (v: number): number => Math.min(100, Math.max(0, v))
const count = (v: unknown): number => (finite(v) && v >= 0 ? Math.floor(v) : 0)

/** Number of user-visible characters (Thai vowels and tone marks do not count separately). */
export function nameLength(name: string): number {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name)].length
}

/** Trimmed name, or null when empty or longer than the limit (FR-22). */
export function sanitizeName(raw: unknown, c: CareConfig = CARE): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  const length = nameLength(name)
  return length >= 1 && length <= c.nameMaxLength ? name : null
}

/** A new pet (FR-23). Throws if the name is not usable. */
export function createPet(name: string, now: number, c: CareConfig = CARE): PetRecord {
  const clean = sanitizeName(name, c)
  if (!clean) throw new Error(`Pet name must be 1-${c.nameMaxLength} characters`)
  return {
    version: 1,
    name: clean,
    species: 'cat',
    adoptedAt: now,
    needs: { ...c.startNeeds },
    updatedAt: now,
    counters: { feeds: 0, pets: 0 }
  }
}

/**
 * Reads a stored record. Returns null when it cannot be trusted (missing name, species or
 * timestamps); the caller then treats the file as damaged (FR-33). Needs are clamped.
 */
export function parsePetRecord(raw: unknown, c: CareConfig = CARE): PetRecord | null {
  if (!isRecord(raw) || raw['version'] !== 1) return null
  const name = sanitizeName(raw['name'], c)
  const species = raw['species']
  const { adoptedAt, updatedAt } = raw
  const needs = raw['needs']
  if (!name || !(PET_SPECIES as readonly unknown[]).includes(species)) return null
  if (!finite(adoptedAt) || !finite(updatedAt) || !isRecord(needs)) return null
  if (!finite(needs['hunger']) || !finite(needs['happiness'])) return null
  const counters = isRecord(raw['counters']) ? raw['counters'] : {}
  return {
    version: 1,
    name,
    species: species as PetSpecies,
    adoptedAt,
    needs: { hunger: clampNeed(needs['hunger']), happiness: clampNeed(needs['happiness']) },
    updatedAt,
    counters: { feeds: count(counters['feeds']), pets: count(counters['pets']) }
  }
}
