/**
 * requirement-v7.md FR-105: makes a coat-color variant of every sheet of the default look.
 *
 * Run: npm run sprite:recolor -- <look-id> [--preset gray|black|white]
 *        [--hue H] [--sat S] [--lscale K] [--lshift B]
 *
 * Writes assets/models/<sheet-file>-<look-id>.png for each sheet and a side-by-side preview
 * (left: today's look, right: the new one) to dist/look-preview-<look-id>.png. Nothing is used
 * by the app until the look is added to cat-sprite.json, after the user approves the preview.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng, type RgbaImage } from './lib/png.mts'
import { LOOK_PRESETS, recolorCoat, type CoatColor } from './lib/recolor.mts'

const MODEL_DIR = join(import.meta.dirname, '..', 'assets', 'models')
const PREVIEW_DIR = join(import.meta.dirname, '..', 'dist')
const PREVIEW_SCALE = 0.4
const LOOK_ID = /^[a-z][a-z0-9-]{0,19}$/

const args = process.argv.slice(2)
const look = args[0]
function option(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
if (!look || !LOOK_ID.test(look)) {
  console.error(
    'Usage: npm run sprite:recolor -- <look-id> [--preset gray|black|white] [--hue H] [--sat S] [--lscale K] [--lshift B]'
  )
  process.exit(1)
}
const base = LOOK_PRESETS[option('preset') ?? look]
const num = (name: string, fallback: number | undefined): number => {
  const raw = option(name)
  const value = raw === undefined ? fallback : Number(raw)
  if (value === undefined || !Number.isFinite(value)) {
    console.error(`--${name} is needed (no preset named "${option('preset') ?? look}")`)
    process.exit(1)
  }
  return value
}
const color: CoatColor = {
  hue: num('hue', base?.hue),
  sat: num('sat', base?.sat),
  lightScale: num('lscale', base?.lightScale),
  lightShift: num('lshift', base?.lightShift)
}

/** Box-filter downscale for the preview. */
function shrink(img: RgbaImage, scale: number): RgbaImage {
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const data = new Uint8Array(width * height * 4)
  const step = 1 / scale
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sum = [0, 0, 0, 0]
      let n = 0
      for (
        let sy = Math.floor(y * step);
        sy < Math.min(img.height, Math.floor((y + 1) * step));
        sy++
      ) {
        for (
          let sx = Math.floor(x * step);
          sx < Math.min(img.width, Math.floor((x + 1) * step));
          sx++
        ) {
          const i = (sy * img.width + sx) * 4
          const a = img.data[i + 3] ?? 0
          for (let k = 0; k < 3; k++) sum[k]! += (img.data[i + k] ?? 0) * a
          sum[3]! += a
          n++
        }
      }
      const o = (y * width + x) * 4
      const alpha = sum[3]! / Math.max(1, n)
      for (let k = 0; k < 3; k++) data[o + k] = sum[3]! > 0 ? Math.round(sum[k]! / sum[3]!) : 0
      data[o + 3] = Math.round(alpha)
    }
  }
  return { width, height, data }
}

/** Pastes `src` onto `dst` at (x0, y0) over a light background (alpha blended). */
function paste(dst: RgbaImage, src: RgbaImage, x0: number, y0: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4
      const d = ((y0 + y) * dst.width + (x0 + x)) * 4
      const a = (src.data[s + 3] ?? 0) / 255
      for (let k = 0; k < 3; k++)
        dst.data[d + k] = Math.round((src.data[s + k] ?? 0) * a + (dst.data[d + k] ?? 0) * (1 - a))
    }
  }
}

const model = JSON.parse(readFileSync(join(MODEL_DIR, 'cat-sprite.json'), 'utf8')) as {
  sheets: Record<string, { file: string }>
}
const files: Record<string, string> = {}
const pairs: Array<[RgbaImage, RgbaImage]> = []
for (const [sheet, { file }] of Object.entries(model.sheets)) {
  const original = decodePng(readFileSync(join(MODEL_DIR, file)))
  const recolored: RgbaImage = { ...original, data: new Uint8Array(original.data) }
  const changed = recolorCoat(recolored, color)
  const out = file.replace(/\.png$/, `-${look}.png`)
  writeFileSync(join(MODEL_DIR, out), encodePng(recolored))
  files[sheet] = out
  pairs.push([shrink(original, PREVIEW_SCALE), shrink(recolored, PREVIEW_SCALE)])
  console.log(`${file} -> ${out}  (${changed} px recolored)`)
}

const gap = 16
const width = Math.max(...pairs.map(([a]) => a.width)) * 2 + gap * 3
const height = pairs.reduce((h, [a]) => h + a.height + gap, gap)
const preview: RgbaImage = { width, height, data: new Uint8Array(width * height * 4).fill(255) }
let y = gap
for (const [a, b] of pairs) {
  paste(preview, a, gap, y)
  paste(preview, b, gap * 2 + a.width, y)
  y += a.height + gap
}
mkdirSync(PREVIEW_DIR, { recursive: true })
const previewFile = join(PREVIEW_DIR, `look-preview-${look}.png`)
writeFileSync(previewFile, encodePng(preview))
console.log(`preview (left: today, right: ${look}): ${previewFile}`)
console.log('After approval, add to cat-sprite.json "looks":')
console.log(JSON.stringify({ [look]: files }, null, 2))
