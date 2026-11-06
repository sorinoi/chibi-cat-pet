import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { writeJsonAtomic } from './lib/jsonFile'
import { parsePetRecord, type PetRecord } from '../shared/petRecord'

export type PetFileResult =
  | { status: 'missing' }
  | { status: 'ok'; record: PetRecord }
  /** The file could not be used and was moved aside to `movedTo` (FR-33). */
  | { status: 'damaged'; movedTo: string }

/** Reads pet.json. A damaged file is renamed to pet.json.bad so the app never crashes on it. */
export function readPetFile(path: string): PetFileResult {
  if (!existsSync(path)) return { status: 'missing' }
  let record: PetRecord | null = null
  try {
    record = parsePetRecord(JSON.parse(readFileSync(path, 'utf8')) as unknown)
  } catch {
    record = null
  }
  if (record) return { status: 'ok', record }
  const movedTo = `${path}.bad`
  rmSync(movedTo, { force: true })
  renameSync(path, movedTo)
  return { status: 'damaged', movedTo }
}

/** Atomic write (FR-31). */
export function writePetFile(path: string, record: PetRecord): void {
  writeJsonAtomic(path, record)
}

/** FR-32: the pet's data is gone immediately. */
export function deletePetFile(path: string): void {
  rmSync(path, { force: true })
  rmSync(`${path}.tmp`, { force: true })
}
