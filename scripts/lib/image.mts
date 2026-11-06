/** Small image helpers for the scripts (no dependencies). */
import type { RgbaImage } from './png.mts'

/** Area-average downscale with premultiplied alpha, so edges do not get dark halos. */
export function resize(src: RgbaImage, scale: number): RgbaImage {
  if (scale === 1) return src
  const width = Math.max(1, Math.round(src.width * scale))
  const height = Math.max(1, Math.round(src.height * scale))
  const sx = src.width / width
  const sy = src.height / height
  const data = new Uint8Array(width * height * 4)
  for (let oy = 0; oy < height; oy++) {
    const y0 = oy * sy
    const y1 = y0 + sy
    for (let ox = 0; ox < width; ox++) {
      const x0 = ox * sx
      const x1 = x0 + sx
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let area = 0
      for (let y = Math.floor(y0); y < Math.ceil(y1) && y < src.height; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        for (let x = Math.floor(x0); x < Math.ceil(x1) && x < src.width; x++) {
          const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0))
          const i = (y * src.width + x) * 4
          const alpha = src.data[i + 3] * w
          r += src.data[i] * alpha
          g += src.data[i + 1] * alpha
          b += src.data[i + 2] * alpha
          a += alpha
          area += w
        }
      }
      const d = (oy * width + ox) * 4
      if (a > 0) {
        data[d] = Math.round(r / a)
        data[d + 1] = Math.round(g / a)
        data[d + 2] = Math.round(b / a)
        data[d + 3] = Math.round(a / area)
      }
    }
  }
  return { width, height, data }
}
