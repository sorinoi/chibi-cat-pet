/**
 * requirement-v7.md FR-105: coat recoloring. Finds the orange coat by hue, chroma and value
 * (soft edges, so anti-aliased borders change partly) and gives it a new hue, saturation and
 * lightness, keeping its shading. Outlines (dark), cream fur and white (low chroma), pink ears and
 * cheeks, the red collar and bowl (other hues), the yellow bell and sparkles (very high chroma)
 * stay as they are. Pure, unit tested.
 */
import type { RgbaImage } from './png.mts'

/** Which pixels count as coat. Hue in degrees; chroma and value 0..1 (HSV). */
export interface CoatRange {
  hueMin: number
  hueMax: number
  /** Degrees over which the weight fades to 0 outside [hueMin, hueMax]. */
  hueSoft: number
  /** Below chromaMin: not coat; at chromaFull and above: fully coat. */
  chromaMin: number
  chromaFull: number
  /** Above chromaMax (+ chromaSoft): not coat (bright yellows). */
  chromaMax: number
  chromaSoft: number
  /** Below valueMin - valueSoft: not coat (outlines); fully coat from valueMin. */
  valueMin: number
  valueSoft: number
}

/** The new coat color: HSL hue and saturation, lightness = old lightness x scale + shift. */
export interface CoatColor {
  hue: number
  sat: number
  lightScale: number
  lightShift: number
}

/** Measured on the orange-and-white cat (2026-11-08): coat h20-40, chroma 0.2-0.6. */
export const ORANGE_COAT: CoatRange = {
  hueMin: 16,
  hueMax: 42,
  hueSoft: 8,
  chromaMin: 0.16,
  chromaFull: 0.28,
  chromaMax: 0.7,
  chromaSoft: 0.08,
  valueMin: 0.4,
  valueSoft: 0.12
}

/** Starting points for the looks in requirement-v7.md section 13; tune per look. */
export const LOOK_PRESETS: Record<string, CoatColor> = {
  gray: { hue: 215, sat: 0.07, lightScale: 0.86, lightShift: 0 },
  black: { hue: 225, sat: 0.06, lightScale: 0.32, lightShift: 0.02 },
  white: { hue: 35, sat: 0.35, lightScale: 0.2, lightShift: 0.74 }
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const ramp = (v: number, from: number, to: number): number =>
  to === from ? (v >= to ? 1 : 0) : clamp01((v - from) / (to - from))

function hsv(r: number, g: number, b: number): { h: number; c: number; v: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const c = max - min
  let h = 0
  if (c > 0) {
    if (max === r) h = ((g - b) / c) % 6
    else if (max === g) h = (b - r) / c + 2
    else h = (r - g) / c + 4
  }
  return { h: (h * 60 + 360) % 360, c: c / 255, v: max / 255 }
}

/** How much a pixel is coat, 0..1. */
export function coatWeight(
  r: number,
  g: number,
  b: number,
  range: CoatRange = ORANGE_COAT
): number {
  const { h, c, v } = hsv(r, g, b)
  const outside = h < range.hueMin ? range.hueMin - h : h > range.hueMax ? h - range.hueMax : 0
  const hueW = 1 - clamp01(outside / range.hueSoft)
  const chromaW =
    ramp(c, range.chromaMin, range.chromaFull) *
    (1 - ramp(c, range.chromaMax, range.chromaMax + range.chromaSoft))
  const valueW = ramp(v, range.valueMin - range.valueSoft, range.valueMin)
  return hueW * chromaW * valueW
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number): number => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Recolors the coat in place. Returns how many pixels changed. */
export function recolorCoat(
  image: RgbaImage,
  color: CoatColor,
  range: CoatRange = ORANGE_COAT
): number {
  const d = image.data
  let changed = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const r = d[i] ?? 0
    const g = d[i + 1] ?? 0
    const b = d[i + 2] ?? 0
    const w = coatWeight(r, g, b, range)
    if (w <= 0) continue
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255
    const [nr, ng, nb] = hslToRgb(
      color.hue,
      color.sat,
      clamp01(l * color.lightScale + color.lightShift)
    )
    d[i] = Math.round(r + (nr - r) * w)
    d[i + 1] = Math.round(g + (ng - g) * w)
    d[i + 2] = Math.round(b + (nb - b) * w)
    changed++
  }
  return changed
}
