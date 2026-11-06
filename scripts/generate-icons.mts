/**
 * Draws the app icon (a flat cat face) and writes:
 *   resources/icon.png            256 px, window + about dialog
 *   resources/tray.png (+@1.25x, @1.5x, @2x)  16 px base, tray
 *   build/icon.ico                16..256 px, exe + installer
 * No dependencies: PNG and ICO are encoded by hand with node:zlib.
 * Run: npm run icons:build
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

type RGBA = readonly [number, number, number, number]

const COLORS = {
  fur: [232, 137, 58, 255],
  stripe: [179, 86, 28, 255],
  earInner: [242, 167, 160, 255],
  muzzle: [247, 230, 210, 255],
  eye: [40, 40, 40, 255],
  nose: [224, 122, 122, 255],
  clear: [0, 0, 0, 0]
} as const satisfies Record<string, RGBA>

/** Supersampling per axis for anti-aliased edges. */
const SUPERSAMPLE = 4

function inTriangle(px: number, py: number, t: readonly number[]): boolean {
  const [ax, ay, bx, by, cx, cy] = t
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Color at a point in unit space (0..1, y down). Painter's order: last match wins. */
function sample(x: number, y: number, small: boolean): RGBA {
  let c: RGBA = COLORS.clear
  const earL = [0.12, 0.5, 0.2, 0.06, 0.47, 0.3]
  const earR = [0.88, 0.5, 0.8, 0.06, 0.53, 0.3]
  if (inTriangle(x, y, earL) || inTriangle(x, y, earR)) c = COLORS.fur
  if (!small) {
    if (inTriangle(x, y, [0.19, 0.42, 0.23, 0.16, 0.4, 0.3])) c = COLORS.earInner
    if (inTriangle(x, y, [0.81, 0.42, 0.77, 0.16, 0.6, 0.3])) c = COLORS.earInner
  }
  if (inEllipse(x, y, 0.5, 0.58, 0.42, 0.36)) {
    c = COLORS.fur
    // Forehead stripes (skipped at tray size, where they turn to mush).
    if (!small && y < 0.42 && Math.abs(x - 0.5) < 0.16 && Math.sin(x * 60) > 0.55) c = COLORS.stripe
  }
  if (inEllipse(x, y, 0.5, 0.76, 0.2, 0.13)) c = COLORS.muzzle
  if (inEllipse(x, y, 0.34, 0.56, 0.065, small ? 0.09 : 0.085)) c = COLORS.eye
  if (inEllipse(x, y, 0.66, 0.56, 0.065, small ? 0.09 : 0.085)) c = COLORS.eye
  if (inTriangle(x, y, [0.45, 0.68, 0.55, 0.68, 0.5, 0.74])) c = COLORS.nose
  return c
}

function render(size: number): Uint8Array {
  const small = size <= 32
  const out = new Uint8Array(size * size * 4)
  const n = SUPERSAMPLE * SUPERSAMPLE
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const c = sample(
            (px + (sx + 0.5) / SUPERSAMPLE) / size,
            (py + (sy + 0.5) / SUPERSAMPLE) / size,
            small
          )
          // Premultiply so edges blend correctly.
          r += c[0] * c[3]
          g += c[1] * c[3]
          b += c[2] * c[3]
          a += c[3]
        }
      }
      const i = (py * size + px) * 4
      out[i] = a ? Math.round(r / a) : 0
      out[i + 1] = a ? Math.round(g / a) : 0
      out[i + 2] = a ? Math.round(b / a) : 0
      out[i + 3] = Math.round(a / n)
    }
  }
  return out
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

function encodePng(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0))
  ])
}

/** ICO container with PNG-compressed entries (supported since Windows Vista). */
function encodeIco(images: ReadonlyArray<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const png = (size: number): Buffer => encodePng(size, render(size))
const write = (relative: string, data: Buffer): void => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
  console.log(`${relative} (${data.length} bytes)`)
}

write('resources/icon.png', png(256))
write('resources/tray.png', png(16))
write('resources/tray@1.25x.png', png(20))
write('resources/tray@1.5x.png', png(24))
write('resources/tray@2x.png', png(32))
write(
  'build/icon.ico',
  encodeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: png(size) })))
)
