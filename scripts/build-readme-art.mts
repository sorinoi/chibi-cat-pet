/**
 * Renders the animated previews used by README.md from the real sprite sheets and clip
 * timings, so the pictures always match the app. Output: docs/images/*.png (APNG, which
 * GitHub shows animated; other viewers show the first frame).
 *
 * Run: npm run readme:art
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodeApng, type ApngFrame, type RgbaImage } from './lib/png.mts'
import { resize } from './lib/image.mts'
import { parseModelConfig, type ClipName, type SpriteClip } from '../src/shared/modelConfig.ts'

const MODEL_DIR = 'assets/models'
const MODEL_FILE = 'cat-sprite.json'
const OUT_DIR = 'docs/images'
/** Transparent margin around the tightest box that holds every frame. */
const PADDING = 6
/** One-shot clips hold their last frame this long before the preview loops. */
const ONCE_HOLD_MS = 900
/** Extra rounds of the looping part for clips with an intro (`loopFrom`). */
const LOOP_REPEATS = 2
/** Hero scene: pixels the cat moves per walk frame, and walk frames each way. */
const HERO_STEP_PX = 7
const HERO_WALK_FRAMES = 24
/** Output size relative to the sprite (smaller files; README shows them small anyway). */
const CLIP_SCALE = 0.6
const HERO_SCALE = 1

const model = parseModelConfig(JSON.parse(readFileSync(join(MODEL_DIR, MODEL_FILE), 'utf8')))
const sheetImages = new Map<string, RgbaImage>()
for (const [name, sheet] of Object.entries(model.sheets)) {
  if (sheet.scale !== 1) throw new Error(`Sheet "${name}" has scale ${sheet.scale}; not supported`)
  sheetImages.set(name, decodePng(readFileSync(join(MODEL_DIR, sheet.file))))
}

// A shared frame with every sheet's feet anchor on one point (like modelFrame() in the app).
const sheets = Object.values(model.sheets)
const anchorX = Math.max(...sheets.map((s) => s.anchor.x))
const anchorY = Math.max(...sheets.map((s) => s.anchor.y))
const frameW = anchorX + Math.max(...sheets.map((s) => s.cellWidth - s.anchor.x))
const frameH = anchorY + Math.max(...sheets.map((s) => s.cellHeight - s.anchor.y))

interface Cel {
  clip: ClipName
  frame: number
  delayMs: number
  mirror?: boolean
  /** Horizontal offset in the output, for the walking hero scene. */
  dx?: number
}

function clipOf(name: ClipName): SpriteClip {
  const clip = model.clips[name]
  if (!clip) throw new Error(`Model has no "${name}" clip`)
  return clip
}

/** Draws one sprite cell into a full frame-sized image, feet on the shared anchor. */
function renderCel(name: ClipName, frame: number, mirror = false): RgbaImage {
  const clip = clipOf(name)
  const sheet = model.sheets[clip.sheet]
  const src = sheetImages.get(clip.sheet)
  if (!sheet || !src) throw new Error(`Missing sheet "${clip.sheet}"`)
  const out = new Uint8Array(frameW * frameH * 4)
  const ox = anchorX - sheet.anchor.x
  const oy = anchorY - sheet.anchor.y
  for (let y = 0; y < sheet.cellHeight; y++) {
    for (let x = 0; x < sheet.cellWidth; x++) {
      const sx = (clip.column + frame) * sheet.cellWidth + (mirror ? sheet.cellWidth - 1 - x : x)
      const s = ((clip.row * sheet.cellHeight + y) * src.width + sx) * 4
      const d = ((oy + y) * frameW + ox + x) * 4
      out.set(src.data.subarray(s, s + 4), d)
    }
  }
  return { width: frameW, height: frameH, data: out }
}

/** The frames of one clip as a looping preview. */
function clipCels(name: ClipName): Cel[] {
  const clip = clipOf(name)
  const cels: Cel[] = clip.frameMs.map((delayMs, frame) => ({ clip: name, frame, delayMs }))
  if (clip.loop && clip.loopFrom > 0) {
    for (let r = 0; r < LOOP_REPEATS; r++) {
      for (let f = clip.loopFrom; f < clip.frames; f++) {
        cels.push({ clip: name, frame: f, delayMs: clip.frameMs[f] })
      }
    }
  }
  if (!clip.loop) cels[cels.length - 1].delayMs += ONCE_HOLD_MS
  return cels
}

/** Hero scene: walk in, react to care, walk back, fall asleep. Ends where it starts. */
function heroCels(): Cel[] {
  const walk = clipOf('walk')
  const walkTowardRight = model.walkFacing === 'right'
  const walking = (toRight: boolean, startDx: number): Cel[] =>
    Array.from({ length: HERO_WALK_FRAMES }, (_, i) => ({
      clip: 'walk' as const,
      frame: i % walk.frames,
      delayMs: walk.frameMs[i % walk.frames],
      mirror: toRight !== walkTowardRight,
      dx: startDx + (toRight ? i + 1 : -(i + 1)) * HERO_STEP_PX
    }))
  const travel = HERO_WALK_FRAMES * HERO_STEP_PX
  const at = (dx: number, cels: Cel[]): Cel[] => cels.map((c) => ({ ...c, dx }))
  const idle = clipCels('idle').slice(0, 2)
  return [
    ...at(0, idle),
    ...walking(true, 0),
    ...at(travel, clipCels('happy')),
    ...at(travel, clipCels('eat')),
    ...at(travel, clipCels('pet')),
    ...walking(false, travel),
    ...at(0, clipCels('sleep'))
  ]
}

/** Smallest box (in frame coordinates) with any visible pixel across these cels. */
function contentBox(cels: Cel[]): { left: number; top: number; right: number; bottom: number } {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const cel of cels) {
    const img = renderCel(cel.clip, cel.frame, cel.mirror)
    const dx = cel.dx ?? 0
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        if (img.data[(y * frameW + x) * 4 + 3] === 0) continue
        left = Math.min(left, x + dx)
        right = Math.max(right, x + dx)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  }
  return { left, top, right, bottom }
}

function toApng(cels: Cel[], box: ReturnType<typeof contentBox>, scale: number): Buffer {
  const width = box.right - box.left + 1 + PADDING * 2
  const height = box.bottom - box.top + 1 + PADDING * 2
  const cache = new Map<string, RgbaImage>()
  const frames: ApngFrame[] = cels.map((cel) => {
    const key = `${cel.clip}:${cel.frame}:${cel.mirror ? 1 : 0}`
    let img = cache.get(key)
    if (!img) {
      img = renderCel(cel.clip, cel.frame, cel.mirror)
      cache.set(key, img)
    }
    const data = new Uint8Array(width * height * 4)
    const ox = PADDING - box.left + (cel.dx ?? 0)
    const oy = PADDING - box.top
    for (let y = 0; y < frameH; y++) {
      const ty = y + oy
      if (ty < 0 || ty >= height) continue
      for (let x = 0; x < frameW; x++) {
        const tx = x + ox
        if (tx < 0 || tx >= width) continue
        const s = (y * frameW + x) * 4
        if (img.data[s + 3] === 0) continue
        data.set(img.data.subarray(s, s + 4), (ty * width + tx) * 4)
      }
    }
    return { image: resize({ width, height, data }, scale), delayMs: cel.delayMs }
  })
  return encodeApng(mergeRepeats(frames))
}

/** Joins back-to-back identical frames into one longer frame. */
function mergeRepeats(frames: ApngFrame[]): ApngFrame[] {
  const out: ApngFrame[] = []
  for (const f of frames) {
    const last = out[out.length - 1]
    if (last && Buffer.from(last.image.data).equals(Buffer.from(f.image.data))) {
      last.delayMs += f.delayMs
    } else out.push({ ...f })
  }
  return out
}

mkdirSync(OUT_DIR, { recursive: true })

const PREVIEW_CLIPS: ClipName[] = [
  'idle',
  'walk',
  'click',
  'drag',
  'land',
  'sleep',
  'eat',
  'happy',
  'hungry',
  'pet',
  'focusStart',
  'focusDone',
  'longBreak',
  'breakOver',
  'sad',
  'look',
  'stretch',
  'yawn',
  'jump',
  'fall',
  'climb',
  'hang'
]
const previews = PREVIEW_CLIPS.filter((name) => model.clips[name]).map((name) => ({
  name,
  cels: clipCels(name)
}))
// One shared box for all clip previews, so every picture has the same size and baseline.
const sharedBox = contentBox(previews.flatMap((p) => p.cels))

for (const { name, cels } of previews) {
  const file = join(OUT_DIR, `clip-${name}.png`)
  const png = toApng(cels, sharedBox, CLIP_SCALE)
  writeFileSync(file, png)
  console.log(`${file}  ${cels.length} frames  ${(png.length / 1024).toFixed(0)} KB`)
}

const hero = heroCels()
const heroFile = join(OUT_DIR, 'hero.png')
const heroPng = toApng(hero, contentBox(hero), HERO_SCALE)
writeFileSync(heroFile, heroPng)
console.log(`${heroFile}  ${hero.length} frames  ${(heroPng.length / 1024).toFixed(0)} KB`)
