import { Color, Vector3 } from 'three'
import type { PartName } from './parts.mts'

/** A coat preset. Hex colors are sRGB; three converts them to linear on `setHex`. */
export interface CoatPreset {
  id: string
  name: string
  base: number
  belly: number
  muzzle: number
  paws: number
  earInner: number
  nose: number
  iris: number
  pupil: number
  /** Tabby stripes. */
  stripes?: { color: number; frequency: number; width: number }
  /** Calico-style patches: [secondary, tertiary] over the base color. */
  patches?: { colors: [number, number]; threshold: number }
}

export const COAT_PRESETS: readonly CoatPreset[] = [
  {
    id: 'orange-tabby',
    name: 'Orange tabby',
    base: 0xe8893a,
    belly: 0xf7dfc4,
    muzzle: 0xf7e6d2,
    paws: 0xf7dfc4,
    earInner: 0xf2a7a0,
    nose: 0xe07a7a,
    iris: 0x9bbf3a,
    pupil: 0x1a1a1a,
    stripes: { color: 0xb3561c, frequency: 4, width: 0.32 }
  },
  {
    id: 'calico',
    name: 'Calico',
    base: 0xf6f1e9,
    belly: 0xf6f1e9,
    muzzle: 0xfbf8f3,
    paws: 0xfbf8f3,
    earInner: 0xf2a7a0,
    nose: 0xe9a0a0,
    iris: 0xd9a23a,
    pupil: 0x1a1a1a,
    patches: { colors: [0xe0823a, 0x2e2a28], threshold: 0.22 }
  }
]

/** Smooth deterministic pseudo-noise in roughly [-1, 1] for patch shapes. */
export function patchNoise(p: Vector3): number {
  return (
    0.6 * Math.sin(p.x * 9.1 + 1.3) * Math.sin(p.y * 7.3 + 0.7) * Math.sin(p.z * 6.7 + 2.1) +
    0.4 * Math.sin(p.x * 3.7 + p.z * 4.9 + 0.4) * Math.cos(p.y * 5.3 - p.z * 2.3)
  )
}

function stripe(value: number, preset: CoatPreset): boolean {
  const s = preset.stripes
  if (!s) return false
  return Math.sin(value * s.frequency * Math.PI * 2) > 1 - s.width * 2
}

/** Fur color at a point, with tabby stripes or calico patches applied. */
function coat(p: Vector3, stripeCoord: number, preset: CoatPreset): number {
  if (preset.patches) {
    const n = patchNoise(p)
    if (n > preset.patches.threshold) return preset.patches.colors[0]
    if (n < -preset.patches.threshold) return preset.patches.colors[1]
    return preset.base
  }
  if (stripe(stripeCoord, preset)) return preset.stripes?.color ?? preset.base
  return preset.base
}

/**
 * Color for one triangle, picked from its part, centroid and face normal.
 * Coordinates are in model space: +Z forward, +Y up, feet at y = 0.
 */
export function faceColor(
  part: PartName,
  centroid: Vector3,
  normal: Vector3,
  preset: CoatPreset,
  out: Color
): Color {
  let hex: number
  switch (part) {
    case 'body': {
      const isBelly = centroid.y < 0.36 || (centroid.z > 0.22 && centroid.y < 0.5)
      hex = isBelly ? preset.belly : coat(centroid, centroid.z, preset)
      break
    }
    case 'head':
    case 'neck': {
      const forehead = centroid.y > 0.83 && centroid.z > 0.42 && Math.abs(centroid.x) < 0.1
      hex = coat(centroid, forehead ? centroid.x * 1.6 : centroid.y * 1.2, preset)
      break
    }
    case 'tail':
      hex = coat(centroid, centroid.y - centroid.z, preset)
      break
    case 'leg':
      hex = coat(centroid, centroid.y * 1.3, preset)
      break
    case 'ear':
      hex = normal.z > 0.35 ? preset.earInner : coat(centroid, 0, preset)
      break
    case 'paw':
      hex = preset.paws
      break
    case 'muzzle':
      hex = preset.muzzle
      break
    case 'nose':
      hex = preset.nose
      break
    case 'iris':
      hex = preset.iris
      break
    case 'pupil':
      hex = preset.pupil
      break
  }
  return out.setHex(hex)
}
