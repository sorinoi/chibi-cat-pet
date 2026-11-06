/** Standard clip names every pet model maps to (requirement.md section 9). */
export const STANDARD_CLIPS = ['idle', 'walk', 'click', 'drag', 'land', 'sleep'] as const
export type StandardClip = (typeof STANDARD_CLIPS)[number]

/** NFR-02: frames never change faster than this. */
export const MAX_FPS = 30

/** One animation: a run of frames in one sheet row, starting at column 0. */
export interface SpriteClip {
  row: number
  frames: number
  loop: boolean
  /** Frame to restart from when looping (an intro plays once before it). Default 0. */
  loopFrom: number
  /** Duration of each frame in ms (from `frameMs`, or `fps` spread evenly). */
  frameMs: number[]
}

/** Per-model JSON stored next to the sprite sheet in assets/models/. */
export interface ModelConfig {
  id: string
  name: string
  /** Sprite sheet file name, relative to the JSON file. */
  file: string
  sheet: { columns: number; rows: number; cellWidth: number; cellHeight: number }
  /** The point in a cell that stands on the ground (feet center), in cell pixels. */
  anchor: { x: number; y: number }
  /** DIP per sheet pixel at pet size 1.0. */
  displayScale: number
  /** Always-empty margins of a cell, in cell pixels; the window may hang this far off-screen. */
  edgeOverflow: { x: number; top: number; bottom: number }
  /** Direction the walk frames face in the sheet; the other direction is mirrored. */
  walkFacing: 'left' | 'right'
  clips: Record<'idle', SpriteClip> & Partial<Record<StandardClip, SpriteClip>>
  /** License or origin note for the artwork. */
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

function requireNumber(
  obj: Record<string, unknown>,
  key: string,
  where: string,
  { min = 0, integer = false }: { min?: number; integer?: boolean } = {}
): number {
  const value = obj[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    fail(`"${where}.${key}" must be a number >= ${min}`)
  }
  if (integer && !Number.isInteger(value)) fail(`"${where}.${key}" must be an integer`)
  return value
}

function requireRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = obj[key]
  if (!isRecord(value)) fail(`"${key}" must be an object`)
  return value
}

function parseClip(
  name: string,
  raw: unknown,
  sheet: ModelConfig['sheet'],
  maxFps: number
): SpriteClip {
  if (!isRecord(raw)) fail(`clip "${name}" must be an object`)
  const where = `clips.${name}`
  const row = requireNumber(raw, 'row', where, { integer: true })
  if (row >= sheet.rows) fail(`"${where}.row" is outside the sheet`)
  const frames = requireNumber(raw, 'frames', where, { min: 1, integer: true })
  if (frames > sheet.columns) fail(`"${where}.frames" is more than the sheet has columns`)
  if (typeof raw['loop'] !== 'boolean') fail(`"${where}.loop" must be true or false`)
  const loopFrom =
    raw['loopFrom'] === undefined ? 0 : requireNumber(raw, 'loopFrom', where, { integer: true })
  if (loopFrom >= frames) fail(`"${where}.loopFrom" must be less than frames`)

  // NFR-02: never show frames faster than the render cap.
  const minFrameMs = 1000 / maxFps
  let frameMs: number[]
  if (Array.isArray(raw['frameMs'])) {
    const list = raw['frameMs'] as unknown[]
    if (list.length !== frames) fail(`"${where}.frameMs" needs one entry per frame`)
    frameMs = list.map((ms) => {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0)
        fail(`"${where}.frameMs" must be positive numbers`)
      return Math.max(ms, minFrameMs)
    })
  } else {
    const fps = requireNumber(raw, 'fps', where, { min: 0.1 })
    frameMs = Array.from({ length: frames }, () => Math.max(1000 / fps, minFrameMs))
  }
  return { row, frames, loop: raw['loop'], loopFrom, frameMs }
}

/** Validates raw JSON. Throws with a readable reason when the config is unusable. */
export function parseModelConfig(raw: unknown, maxFps = MAX_FPS): ModelConfig {
  if (!isRecord(raw)) fail('expected an object')

  const sheetRaw = requireRecord(raw, 'sheet')
  const sheet = {
    columns: requireNumber(sheetRaw, 'columns', 'sheet', { min: 1, integer: true }),
    rows: requireNumber(sheetRaw, 'rows', 'sheet', { min: 1, integer: true }),
    cellWidth: requireNumber(sheetRaw, 'cellWidth', 'sheet', { min: 1, integer: true }),
    cellHeight: requireNumber(sheetRaw, 'cellHeight', 'sheet', { min: 1, integer: true })
  }

  const anchorRaw = requireRecord(raw, 'anchor')
  const anchor = {
    x: requireNumber(anchorRaw, 'x', 'anchor'),
    y: requireNumber(anchorRaw, 'y', 'anchor')
  }
  if (anchor.x > sheet.cellWidth || anchor.y > sheet.cellHeight)
    fail('"anchor" is outside the cell')

  const overflowRaw = requireRecord(raw, 'edgeOverflow')
  const edgeOverflow = {
    x: requireNumber(overflowRaw, 'x', 'edgeOverflow'),
    top: requireNumber(overflowRaw, 'top', 'edgeOverflow'),
    bottom: requireNumber(overflowRaw, 'bottom', 'edgeOverflow')
  }

  const walkFacing = raw['walkFacing']
  if (walkFacing !== 'left' && walkFacing !== 'right')
    fail('"walkFacing" must be "left" or "right"')

  const clipsRaw = requireRecord(raw, 'clips')
  const clips: Partial<Record<StandardClip, SpriteClip>> = {}
  for (const [key, value] of Object.entries(clipsRaw)) {
    if (!(STANDARD_CLIPS as readonly string[]).includes(key)) fail(`unknown clip "${key}"`)
    clips[key as StandardClip] = parseClip(key, value, sheet, maxFps)
  }
  const idle = clips.idle
  if (!idle) fail('"clips.idle" is required')

  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    file: requireString(raw, 'file'),
    sheet,
    anchor,
    displayScale: requireNumber(raw, 'displayScale', 'model', { min: 0.01 }),
    edgeOverflow,
    walkFacing,
    clips: { ...clips, idle },
    license: requireString(raw, 'license')
  }
}
