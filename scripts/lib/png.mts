/**
 * Minimal PNG codec for 8-bit RGBA (color type 6) and RGB (type 2), non-interlaced.
 * Enough for our own sprite sheets; no dependencies (node:zlib only).
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib'

export interface RgbaImage {
  width: number
  height: number
  /** width * height * 4 bytes, row-major RGBA. */
  data: Uint8Array
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

export function decodePng(file: Uint8Array): RgbaImage {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength)
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG file')
  let width = 0
  let height = 0
  let colorType = -1
  const idat: Buffer[] = []
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const body = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const bitDepth = body[8]
      colorType = body[9]
      const interlace = body[12]
      if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
        throw new Error(
          `Unsupported PNG (bit depth ${bitDepth}, color type ${colorType}, interlace ${interlace})`
        )
      }
    } else if (type === 'IDAT') {
      idat.push(body)
    } else if (type === 'IEND') {
      break
    }
    o += 12 + len
  }
  if (!width || !height) throw new Error('PNG has no IHDR')

  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x]
      const left = x >= bpp ? pixels[dst + x - bpp] : 0
      const up = y > 0 ? pixels[dst - stride + x] : 0
      const upLeft = y > 0 && x >= bpp ? pixels[dst - stride + x - bpp] : 0
      let out: number
      switch (filter) {
        case 0:
          out = value
          break
        case 1:
          out = value + left
          break
        case 2:
          out = value + up
          break
        case 3:
          out = value + ((left + up) >> 1)
          break
        case 4:
          out = value + paeth(left, up, upLeft)
          break
        default:
          throw new Error(`Bad PNG filter ${filter} on row ${y}`)
      }
      pixels[dst + x] = out & 0xff
    }
  }

  if (bpp === 4) return { width, height, data: pixels }
  const data = new Uint8Array(width * height * 4)
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    data[j] = pixels[i]
    data[j + 1] = pixels[i + 1]
    data[j + 2] = pixels[i + 2]
    data[j + 3] = 255
  }
  return { width, height, data }
}

function chunk(type: string, body: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length)
  const typeAndBody = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndBody))
  return Buffer.concat([len, typeAndBody, crc])
}

/** Encodes RGBA with filter 0 per row (simple; zlib still compresses well). */
export function encodePng({ width, height, data }: RgbaImage): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0))
  ])
}
