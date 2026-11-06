import {
  AnimationClip,
  Bone,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Vector3
} from 'three'
import { createAllClips } from './animations.mts'
import { BONES, buildCatGeometry, type BoneName } from './parts.mts'
import type { CoatPreset } from './palette.mts'

export interface BuiltCat {
  root: Group
  mesh: SkinnedMesh
  clips: AnimationClip[]
  triangles: number
}

function buildSkeleton(): { root: Bone; bones: Bone[] } {
  const byName = new Map<BoneName, Bone>()
  const bones = BONES.map((spec) => {
    const bone = new Bone()
    bone.name = spec.name
    byName.set(spec.name, bone)
    return bone
  })
  for (const spec of BONES) {
    const bone = byName.get(spec.name)
    if (!bone) throw new Error(`Missing bone ${spec.name}`)
    const world = new Vector3(...spec.position)
    if (spec.parent) {
      const parentSpec = BONES.find((b) => b.name === spec.parent)
      const parent = byName.get(spec.parent)
      if (!parentSpec || !parent) throw new Error(`Missing parent ${spec.parent}`)
      world.sub(new Vector3(...parentSpec.position))
      parent.add(bone)
    }
    bone.position.copy(world)
  }
  const root = byName.get('root')
  if (!root) throw new Error('Missing root bone')
  return { root, bones }
}

/** Builds the rigged, colored cat with its procedural clips. */
export function buildCat(preset: CoatPreset): BuiltCat {
  const geometry = buildCatGeometry(preset)
  const material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.85,
    metalness: 0
  })
  material.name = 'fur'

  const mesh = new SkinnedMesh(geometry, material)
  mesh.name = 'cat'
  const { root: rootBone, bones } = buildSkeleton()
  mesh.add(rootBone)
  mesh.updateMatrixWorld(true)
  mesh.bind(new Skeleton(bones))

  const root = new Group()
  root.name = `cat-${preset.id}`
  root.add(mesh)

  return {
    root,
    mesh,
    clips: createAllClips(),
    triangles: geometry.getAttribute('position').count / 3
  }
}
