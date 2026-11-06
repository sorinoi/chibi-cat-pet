import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Uint16BufferAttribute,
  Vector3
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { faceColor, type CoatPreset } from './palette.mts'

/**
 * Cat layout in model space: +Z forward, +Y up, feet at y = 0, about 1 unit tall.
 * The cat's left side is +X.
 */
export type Vec3 = readonly [number, number, number]

export type BoneName =
  | 'root'
  | 'torso'
  | 'chest'
  | 'hips'
  | 'head'
  | 'earL'
  | 'earR'
  | 'eyeL'
  | 'eyeR'
  | 'legFL'
  | 'legFR'
  | 'legBL'
  | 'legBR'
  | 'tail0'
  | 'tail1'
  | 'tail2'
  | 'tail3'

export interface BoneSpec {
  name: BoneName
  parent: BoneName | null
  /** Rest position in model space. Rest rotations are identity. */
  position: Vec3
}

export type PartName =
  'body' | 'neck' | 'head' | 'muzzle' | 'nose' | 'ear' | 'iris' | 'pupil' | 'leg' | 'paw' | 'tail'

const LEG = { frontZ: 0.2, backZ: -0.21, frontX: 0.11, backX: 0.12, top: 0.4, pivot: 0.38 }
const EYE = { x: 0.075, y: 0.81, z: 0.566 }
const EAR = { x: 0.1, y: 0.91, z: 0.41 }

/** Tail spine. Bones tail0..tail3 sit on the first four points; the last is the tip. */
export const TAIL_POINTS: readonly Vec3[] = [
  [0, 0.5, -0.34],
  [0, 0.56, -0.5],
  [0, 0.7, -0.6],
  [0, 0.86, -0.64],
  [0, 0.99, -0.6]
]
const TAIL_BONES: readonly BoneName[] = ['tail0', 'tail1', 'tail2', 'tail3']

export const BONES: readonly BoneSpec[] = [
  { name: 'root', parent: null, position: [0, 0, 0] },
  { name: 'torso', parent: 'root', position: [0, 0.47, 0] },
  { name: 'chest', parent: 'root', position: [0, 0.47, 0.2] },
  { name: 'hips', parent: 'root', position: [0, 0.47, -0.2] },
  { name: 'head', parent: 'chest', position: [0, 0.66, 0.32] },
  { name: 'earL', parent: 'head', position: [EAR.x, EAR.y, EAR.z] },
  { name: 'earR', parent: 'head', position: [-EAR.x, EAR.y, EAR.z] },
  { name: 'eyeL', parent: 'head', position: [EYE.x, EYE.y, EYE.z] },
  { name: 'eyeR', parent: 'head', position: [-EYE.x, EYE.y, EYE.z] },
  { name: 'legFL', parent: 'chest', position: [LEG.frontX, LEG.pivot, LEG.frontZ] },
  { name: 'legFR', parent: 'chest', position: [-LEG.frontX, LEG.pivot, LEG.frontZ] },
  { name: 'legBL', parent: 'hips', position: [LEG.backX, LEG.pivot, LEG.backZ] },
  { name: 'legBR', parent: 'hips', position: [-LEG.backX, LEG.pivot, LEG.backZ] },
  { name: 'tail0', parent: 'hips', position: TAIL_POINTS[0] },
  { name: 'tail1', parent: 'tail0', position: TAIL_POINTS[1] },
  { name: 'tail2', parent: 'tail1', position: TAIL_POINTS[2] },
  { name: 'tail3', parent: 'tail2', position: TAIL_POINTS[3] }
]

export const boneIndex = (name: BoneName): number => BONES.findIndex((b) => b.name === name)

// ---------------------------------------------------------------------------
// Primitive helpers (all return geometry already placed in model space)

function ellipsoid(center: Vec3, radii: Vec3, widthSeg: number, heightSeg: number): BufferGeometry {
  return new SphereGeometry(1, widthSeg, heightSeg)
    .scale(radii[0], radii[1], radii[2])
    .translate(center[0], center[1], center[2])
}

/** Cylinder from `a` (radius rA) to `b` (radius rB). */
function cylinderBetween(a: Vec3, b: Vec3, rA: number, rB: number, radial: number): BufferGeometry {
  const va = new Vector3(...a)
  const vb = new Vector3(...b)
  const dir = vb.clone().sub(va)
  const geo = new CylinderGeometry(rB, rA, dir.length(), radial, 1, false)
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()))
  const mid = va.add(vb).multiplyScalar(0.5)
  return geo.translate(mid.x, mid.y, mid.z)
}

/** Four-sided ear with its base at `base`, tipped outward by `tilt` radians. */
function ear(base: Vec3, tilt: number): BufferGeometry {
  const height = 0.15
  return new ConeGeometry(0.075, height, 4, 1, true)
    .rotateY(Math.PI / 4)
    .translate(0, height / 2, 0)
    .rotateX(-0.15)
    .rotateZ(tilt)
    .translate(base[0], base[1], base[2])
}

/** Tapered tube along TAIL_POINTS with linear-blend weights across the tail bones. */
function tail(): { geometry: BufferGeometry; weights: (vertex: number) => SkinWeights } {
  const tubular = 12
  const radial = 6
  const [rootRadius, tipRadius] = [0.045, 0.026]
  const curve = new CatmullRomCurve3(TAIL_POINTS.map((p) => new Vector3(...p)))
  const geometry = new TubeGeometry(curve, tubular, 1, radial, false)

  const pos = geometry.getAttribute('position')
  const v = new Vector3()
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular
    const center = curve.getPointAt(t)
    const radius = rootRadius + (tipRadius - rootRadius) * t
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(radius).add(center)
      pos.setXYZ(idx, v.x, v.y, v.z)
    }
  }

  const weights = (vertex: number): SkinWeights => {
    const ring = Math.floor(vertex / (radial + 1))
    const u = (ring / tubular) * TAIL_BONES.length
    const k = Math.min(Math.floor(u), TAIL_BONES.length - 1)
    const f = Math.min(u - k, 1)
    const a = TAIL_BONES[k]
    const b = TAIL_BONES[Math.min(k + 1, TAIL_BONES.length - 1)]
    if (a === b || f === 0) return [[a, 1]]
    return [
      [a, 1 - f],
      [b, f]
    ]
  }
  return { geometry, weights }
}

// ---------------------------------------------------------------------------
// Assembly

type SkinWeights = ReadonlyArray<readonly [BoneName, number]>

interface PartSpec {
  part: PartName
  geometry: BufferGeometry
  weights: (vertex: number) => SkinWeights
}

const rigid = (bone: BoneName) => (): SkinWeights => [[bone, 1]]

function partSpecs(): PartSpec[] {
  const specs: PartSpec[] = [
    {
      part: 'body',
      geometry: ellipsoid([0, 0.47, 0], [0.2, 0.19, 0.38], 12, 8),
      weights: rigid('torso')
    },
    {
      part: 'neck',
      geometry: cylinderBetween([0, 0.55, 0.24], [0, 0.72, 0.38], 0.1, 0.12, 7),
      weights: rigid('head')
    },
    {
      part: 'head',
      geometry: ellipsoid([0, 0.79, 0.42], [0.2, 0.175, 0.18], 12, 8),
      weights: rigid('head')
    },
    {
      part: 'muzzle',
      geometry: ellipsoid([0, 0.725, 0.555], [0.09, 0.06, 0.06], 8, 6),
      weights: rigid('head')
    },
    {
      part: 'nose',
      geometry: ellipsoid([0, 0.765, 0.6], [0.022, 0.016, 0.012], 6, 3),
      weights: rigid('head')
    },
    { part: 'ear', geometry: ear([EAR.x, EAR.y, EAR.z], -0.3), weights: rigid('earL') },
    { part: 'ear', geometry: ear([-EAR.x, EAR.y, EAR.z], 0.3), weights: rigid('earR') }
  ]

  for (const [side, bone] of [
    [1, 'eyeL'],
    [-1, 'eyeR']
  ] as const) {
    specs.push(
      {
        part: 'iris',
        geometry: ellipsoid([side * EYE.x, EYE.y, EYE.z], [0.036, 0.042, 0.02], 8, 6),
        weights: rigid(bone)
      },
      {
        part: 'pupil',
        geometry: ellipsoid([side * EYE.x, EYE.y, EYE.z + 0.017], [0.012, 0.032, 0.008], 6, 4),
        weights: rigid(bone)
      }
    )
  }

  const legs: ReadonlyArray<readonly [BoneName, number, number]> = [
    ['legFL', LEG.frontX, LEG.frontZ],
    ['legFR', -LEG.frontX, LEG.frontZ],
    ['legBL', LEG.backX, LEG.backZ],
    ['legBR', -LEG.backX, LEG.backZ]
  ]
  for (const [bone, x, z] of legs) {
    specs.push(
      {
        part: 'leg',
        geometry: cylinderBetween([x, 0.03, z], [x, LEG.top, z], 0.052, 0.058, 6),
        weights: rigid(bone)
      },
      {
        part: 'paw',
        geometry: ellipsoid([x, 0.034, z + 0.015], [0.062, 0.034, 0.075], 8, 5),
        weights: rigid(bone)
      }
    )
  }

  const tailPart = tail()
  specs.push({ part: 'tail', geometry: tailPart.geometry, weights: tailPart.weights })
  const tip = TAIL_POINTS[TAIL_POINTS.length - 1]
  specs.push({
    part: 'tail',
    geometry: ellipsoid(tip, [0.027, 0.027, 0.027], 6, 4),
    weights: rigid('tail3')
  })

  return specs
}

/** Skin, flatten and color one part. Output is non-indexed for a faceted low-poly look. */
function finalizePart(spec: PartSpec, preset: CoatPreset): BufferGeometry {
  const src = spec.geometry
  const count = src.getAttribute('position').count
  const skinIndex = new Uint16Array(count * 4)
  const skinWeight = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const w = spec.weights(i)
    w.forEach(([bone, weight], slot) => {
      skinIndex[i * 4 + slot] = boneIndex(bone)
      skinWeight[i * 4 + slot] = weight
    })
  }
  src.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4))
  src.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4))
  src.deleteAttribute('uv')
  src.deleteAttribute('normal')

  const geo = src.index ? src.toNonIndexed() : src
  geo.clearGroups()
  geo.computeVertexNormals()

  const pos = geo.getAttribute('position')
  const nrm = geo.getAttribute('normal')
  const colors = new Float32Array(pos.count * 3)
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const centroid = new Vector3()
  const normal = new Vector3()
  const color = new Color()
  for (let tri = 0; tri < pos.count; tri += 3) {
    a.fromBufferAttribute(pos, tri)
    b.fromBufferAttribute(pos, tri + 1)
    c.fromBufferAttribute(pos, tri + 2)
    centroid.copy(a).add(b).add(c).divideScalar(3)
    normal.fromBufferAttribute(nrm, tri)
    faceColor(spec.part, centroid, normal, preset, color)
    for (let k = 0; k < 3; k++) colors.set([color.r, color.g, color.b], (tri + k) * 3)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** Builds the full skinned cat geometry for a coat preset. */
export function buildCatGeometry(preset: CoatPreset): BufferGeometry {
  const parts = partSpecs().map((spec) => finalizePart(spec, preset))
  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('Failed to merge cat geometry (attribute mismatch)')
  parts.forEach((p) => p.dispose())
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}
