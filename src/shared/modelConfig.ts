/** Standard clip names every pet model maps to (requirement.md section 9). */
export const STANDARD_CLIPS = ['idle', 'walk', 'click', 'drag', 'land', 'sleep'] as const
export type StandardClip = (typeof STANDARD_CLIPS)[number]

/** Per-model JSON stored next to the .glb in assets/models/. */
export interface ModelConfig {
  id: string
  name: string
  /** .glb file name, relative to the JSON file. */
  file: string
  /** Uniform scale applied after loading. */
  scale: number
  /** Offset applied after loading so the feet sit on the origin. */
  anchor: [number, number, number]
  /** Standard clip name -> clip name inside the .glb. */
  clips: Partial<Record<StandardClip, string>>
  /** License or origin note for the model. */
  license: string
}

function fail(reason: string): never {
  throw new Error(`Invalid model config: ${reason}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  if (typeof value !== 'string' || value.length === 0) fail(`"${key}" must be a non-empty string`)
  return value
}

/** Validates raw JSON. Throws with a readable reason when the config is unusable. */
export function parseModelConfig(raw: unknown): ModelConfig {
  if (!isRecord(raw)) fail('expected an object')

  const scale = raw['scale']
  if (typeof scale !== 'number' || !(scale > 0)) fail('"scale" must be a positive number')

  const anchor = raw['anchor']
  if (
    !Array.isArray(anchor) ||
    anchor.length !== 3 ||
    !anchor.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    fail('"anchor" must be [x, y, z]')
  }

  const clipsRaw = raw['clips']
  if (!isRecord(clipsRaw)) fail('"clips" must be an object')
  const clips: Partial<Record<StandardClip, string>> = {}
  for (const [key, value] of Object.entries(clipsRaw)) {
    if (!(STANDARD_CLIPS as readonly string[]).includes(key)) fail(`unknown clip "${key}"`)
    if (typeof value !== 'string' || value.length === 0) fail(`clip "${key}" must name a clip`)
    clips[key as StandardClip] = value
  }
  if (!clips.idle) fail('"clips.idle" is required')

  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    file: requireString(raw, 'file'),
    scale,
    anchor: [anchor[0], anchor[1], anchor[2]],
    clips,
    license: requireString(raw, 'license')
  }
}
