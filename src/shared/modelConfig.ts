/** Standard clip names every pet model maps to (requirement.md section 9). */
export const STANDARD_CLIPS = ['idle', 'walk', 'click', 'drag', 'land', 'sleep'] as const
export type StandardClip = (typeof STANDARD_CLIPS)[number]

/** v2 pet-care clips (requirement-v2.md section 9). Optional: v1-style models still load. */
export const CARE_CLIPS = ['eat', 'happy', 'hungry', 'pet'] as const
export type CareClip = (typeof CARE_CLIPS)[number]

/** Optional v3 focus timer reactions (requirement-v3.md section 5); fall back until art exists. */
export const FOCUS_CLIPS = ['focusStart', 'focusDone', 'breakOver', 'longBreak'] as const
export type FocusClip = (typeof FOCUS_CLIPS)[number]

/** Optional v4 life clips (requirement-v4.md section 9). */
export const LIFE_CLIPS = ['sad', 'look', 'stretch', 'yawn'] as const
export type LifeClip = (typeof LIFE_CLIPS)[number]

/**
 * Optional v5 movement clips (requirement-v5.md section 9): `fall` plays `drag` until art
 * exists; without `jump` the cat does not jump (FR-73, FR-75), without `climb` it does not
 * climb (FR-76); `hang` falls back to `climb`.
 */
export const MOVE_CLIPS = ['fall', 'jump', 'climb', 'hang'] as const
export type MoveClip = (typeof MOVE_CLIPS)[number]

export const CLIP_NAMES = [
  ...STANDARD_CLIPS,
  ...CARE_CLIPS,
  ...FOCUS_CLIPS,
  ...LIFE_CLIPS,
  ...MOVE_CLIPS
] as const
export type ClipName = (typeof CLIP_NAMES)[number]

/** What to play instead when a model lacks a clip (section 5 fallbacks). */
const CLIP_FALLBACK: Partial<Record<ClipName, ClipName>> = {
  focusStart: 'click',
  focusDone: 'happy',
  happy: 'click',
  breakOver: 'click',
  longBreak: 'focusDone',
  // FR-58: the morning stretch falls back to happy.
  stretch: 'happy',
  // requirement-v5.md FR-60: a falling cat dangles like a carried one.
  fall: 'drag',
  // FR-76: holding on to the wall without its own art keeps climbing in place.
  hang: 'climb'
}

/** The clip the model can actually play for `name`, following fallbacks; idle as a last resort. */
export function resolveClip(name: ClipName, clips: Partial<Record<ClipName, unknown>>): ClipName {
  let current: ClipName | undefined = name
  for (let hops = 0; current && hops < CLIP_NAMES.length; hops++) {
    if (clips[current]) return current
    current = CLIP_FALLBACK[current]
  }
  return 'idle'
}

/** NFR-02: frames never change faster than this. */
export const MAX_FPS = 30

/** One sprite sheet image: a regular grid of equal cells. */
export interface SpriteSheet {
  /** File name in assets/models/. */
  file: string
  columns: number
  rows: number
  cellWidth: number
  cellHeight: number
  /** The point in a cell that stands on the ground (feet center), in cell pixels. */
  anchor: { x: number; y: number }
  /** Extra scale so cats drawn at different sizes in different sheets match. Default 1. */
  scale: number
}

/** One animation: a run of frames in one row of one sheet. */
export interface SpriteClip {
  /** Key into ModelConfig.sheets. */
  sheet: string
  row: number
  /** First column of the run (requirement-v5.md: a clip may use the middle of a row). Default 0. */
  column: number
  frames: number
  loop: boolean
  /** Frame to restart from when looping (an intro plays once before it). Default 0. */
  loopFrom: number
  /** Duration of each frame in ms (from `frameMs`, or `fps` spread evenly). */
  frameMs: number[]
  /**
   * requirement-v5.md section 8: for wall clips (climb, hang), where the paws touch the wall
   * in the cell (cell px, wall on the right). Main snaps this point to the screen edge.
   */
  wallX?: number
}

/** Per-model JSON stored next to its sprite sheets in assets/models/. */
export interface ModelConfig {
  id: string
  name: string
  sheets: Record<string, SpriteSheet>
  /** DIP per sheet pixel at pet size 1.0. */
  displayScale: number
  /** Always-empty margins of the frame, in sheet pixels; the window may hang this far off-screen. */
  edgeOverflow: { x: number; top: number; bottom: number }
  /** Direction the walk frames face in the sheet; the other direction is mirrored. */
  walkFacing: 'left' | 'right'
  clips: Record<'idle', SpriteClip> & Partial<Record<ClipName, SpriteClip>>
  /**
   * requirement-v7.md FR-100..FR-102: coat colors that share this layout. Each look maps every
   * sheet name to its own image file; the default look uses the sheets' `file`.
   */
  looks: Record<string, Record<string, string>>
  defaultLook: string
  /** License or origin note for the artwork. */
  license: string
}

/** Look ids: short, lowercase (they are stored in pet.json). */
export const LOOK_ID = /^[a-z][a-z0-9-]{0,19}$/

/** A look the model has: `id` when it exists, else the default (FR-103). */
export function lookOf(
  model: Pick<ModelConfig, 'looks' | 'defaultLook'>,
  id: string | null
): string {
  return id !== null && model.looks[id] ? id : model.defaultLook
}

/** The image file of `sheet` in `look` (unknown looks use the default). */
export function sheetFile(
  model: Pick<ModelConfig, 'looks' | 'defaultLook' | 'sheets'>,
  look: string | null,
  sheet: string
): string {
  const file = model.looks[lookOf(model, look)]?.[sheet] ?? model.sheets[sheet]?.file
  if (!file) fail(`no file for sheet "${sheet}"`)
  return file
}

/**
 * The box every sheet's cells are drawn into, in sheet pixels (after each sheet's scale),
 * with every sheet's feet anchor at the same point. The pet window has this shape.
 */
export interface ModelFrame {
  width: number
  height: number
  feetX: number
  feetY: number
}

export function modelFrame(model: Pick<ModelConfig, 'sheets'>): ModelFrame {
  const sheets = Object.values(model.sheets)
  const max = (fn: (s: SpriteSheet) => number): number => Math.max(...sheets.map(fn))
  const feetX = max((s) => s.anchor.x * s.scale)
  const feetY = max((s) => s.anchor.y * s.scale)
  return {
    width: feetX + max((s) => (s.cellWidth - s.anchor.x) * s.scale),
    height: feetY + max((s) => (s.cellHeight - s.anchor.y) * s.scale),
    feetX,
    feetY
  }
}

function fail(reason: string): never {
  throw new Error(`Invalid model config: ${reason}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(obj: Record<string, unknown>, key: string, where = 'model'): string {
  const value = obj[key]
  if (typeof value !== 'string' || value.length === 0) {
    fail(`"${where}.${key}" must be a non-empty string`)
  }
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

function requireRecord(
  obj: Record<string, unknown>,
  key: string,
  where = 'model'
): Record<string, unknown> {
  const value = obj[key]
  if (!isRecord(value)) fail(`"${where}.${key}" must be an object`)
  return value
}

function parseSheet(name: string, raw: unknown): SpriteSheet {
  if (!isRecord(raw)) fail(`sheet "${name}" must be an object`)
  const where = `sheets.${name}`
  const sheet = {
    file: requireString(raw, 'file', where),
    columns: requireNumber(raw, 'columns', where, { min: 1, integer: true }),
    rows: requireNumber(raw, 'rows', where, { min: 1, integer: true }),
    cellWidth: requireNumber(raw, 'cellWidth', where, { min: 1, integer: true }),
    cellHeight: requireNumber(raw, 'cellHeight', where, { min: 1, integer: true })
  }
  const anchorRaw = requireRecord(raw, 'anchor', where)
  const anchor = {
    x: requireNumber(anchorRaw, 'x', `${where}.anchor`),
    y: requireNumber(anchorRaw, 'y', `${where}.anchor`)
  }
  if (anchor.x > sheet.cellWidth || anchor.y > sheet.cellHeight) {
    fail(`"${where}.anchor" is outside the cell`)
  }
  const scale = raw['scale'] === undefined ? 1 : requireNumber(raw, 'scale', where, { min: 0.01 })
  return { ...sheet, anchor, scale }
}

function parseClip(
  name: string,
  raw: unknown,
  sheets: Record<string, SpriteSheet>,
  maxFps: number
): SpriteClip {
  if (!isRecord(raw)) fail(`clip "${name}" must be an object`)
  const where = `clips.${name}`
  const sheetName = requireString(raw, 'sheet', where)
  const sheet = sheets[sheetName]
  if (!sheet) fail(`"${where}.sheet" names an unknown sheet "${sheetName}"`)
  const row = requireNumber(raw, 'row', where, { integer: true })
  if (row >= sheet.rows) fail(`"${where}.row" is outside the sheet`)
  const column =
    raw['column'] === undefined ? 0 : requireNumber(raw, 'column', where, { min: 0, integer: true })
  const frames = requireNumber(raw, 'frames', where, { min: 1, integer: true })
  if (column + frames > sheet.columns) {
    fail(`"${where}.column" + "frames" is more than the sheet has columns`)
  }
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
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
        fail(`"${where}.frameMs" must be positive numbers`)
      }
      return Math.max(ms, minFrameMs)
    })
  } else {
    const fps = requireNumber(raw, 'fps', where, { min: 0.1 })
    frameMs = Array.from({ length: frames }, () => Math.max(1000 / fps, minFrameMs))
  }
  const clip: SpriteClip = {
    sheet: sheetName,
    row,
    column,
    frames,
    loop: raw['loop'],
    loopFrom,
    frameMs
  }
  if (raw['wallX'] !== undefined) {
    clip.wallX = requireNumber(raw, 'wallX', where, { min: 0 })
    if (clip.wallX > sheet.cellWidth) fail(`"${where}.wallX" is outside the cell`)
  }
  return clip
}

/** Validates raw JSON. Throws with a readable reason when the config is unusable. */
export function parseModelConfig(raw: unknown, maxFps = MAX_FPS): ModelConfig {
  if (!isRecord(raw)) fail('expected an object')

  const sheetsRaw = requireRecord(raw, 'sheets')
  const sheets: Record<string, SpriteSheet> = {}
  for (const [name, value] of Object.entries(sheetsRaw)) sheets[name] = parseSheet(name, value)
  if (Object.keys(sheets).length === 0) fail('"sheets" needs at least one sheet')

  const overflowRaw = requireRecord(raw, 'edgeOverflow')
  const edgeOverflow = {
    x: requireNumber(overflowRaw, 'x', 'edgeOverflow'),
    top: requireNumber(overflowRaw, 'top', 'edgeOverflow'),
    bottom: requireNumber(overflowRaw, 'bottom', 'edgeOverflow')
  }

  const walkFacing = raw['walkFacing']
  if (walkFacing !== 'left' && walkFacing !== 'right') {
    fail('"walkFacing" must be "left" or "right"')
  }

  const clipsRaw = requireRecord(raw, 'clips')
  const clips: Partial<Record<ClipName, SpriteClip>> = {}
  for (const [key, value] of Object.entries(clipsRaw)) {
    if (!(CLIP_NAMES as readonly string[]).includes(key)) fail(`unknown clip "${key}"`)
    clips[key as ClipName] = parseClip(key, value, sheets, maxFps)
  }
  const idle = clips.idle
  if (!idle) fail('"clips.idle" is required')

  // FR-100..FR-102: the default look uses the sheets' files; every other look names a file for
  // every sheet (no look may lose clips). Without "looks" the model has one look, "default".
  const defaultLook =
    raw['defaultLook'] === undefined ? 'default' : requireString(raw, 'defaultLook')
  if (!LOOK_ID.test(defaultLook)) fail(`"defaultLook" "${defaultLook}" is not a valid look id`)
  const sheetFiles = Object.fromEntries(Object.entries(sheets).map(([name, s]) => [name, s.file]))
  const looks: Record<string, Record<string, string>> = { [defaultLook]: sheetFiles }
  const looksRaw = raw['looks'] === undefined ? {} : requireRecord(raw, 'looks')
  for (const [id, value] of Object.entries(looksRaw)) {
    if (!LOOK_ID.test(id)) fail(`look id "${id}" must be lowercase letters, digits or dashes`)
    if (id === defaultLook) continue
    if (!isRecord(value)) fail(`look "${id}" must be an object of sheet files`)
    const files: Record<string, string> = {}
    for (const name of Object.keys(sheets)) files[name] = requireString(value, name, `looks.${id}`)
    for (const name of Object.keys(value))
      if (!sheets[name]) fail(`look "${id}" names an unknown sheet "${name}"`)
    looks[id] = files
  }

  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    sheets,
    displayScale: requireNumber(raw, 'displayScale', 'model', { min: 0.01 }),
    edgeOverflow,
    walkFacing,
    clips: { ...clips, idle },
    looks,
    defaultLook,
    license: requireString(raw, 'license')
  }
}
