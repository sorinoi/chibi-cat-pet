import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { IDLE, pulse } from './animations.mts'
import { buildCat } from './buildCat.mts'
import { COAT_PRESETS } from './palette.mts'
import { BONES } from './parts.mts'
import { STANDARD_CLIPS } from '../../src/shared/modelConfig.ts'

/** requirement.md section 9 limits. */
const MAX_TRIANGLES = 20_000

describe.each(COAT_PRESETS)('buildCat($id)', (preset) => {
  const cat = buildCat(preset)

  it('stays within the triangle budget', () => {
    expect(cat.triangles).toBeGreaterThan(0)
    expect(cat.triangles).toBeLessThan(MAX_TRIANGLES)
  })

  it('stands with its feet on the origin', () => {
    const geo = cat.mesh.geometry
    geo.computeBoundingBox()
    const box = geo.boundingBox ?? new Box3()
    expect(Math.abs(box.min.y)).toBeLessThan(0.005)
    const center = box.getCenter(new Vector3())
    expect(Math.abs(center.x)).toBeLessThan(0.01)
  })

  it('binds every bone and keeps skin weights normalized', () => {
    expect(cat.mesh.skeleton.bones.map((b) => b.name)).toEqual(BONES.map((b) => b.name))
    const weights = cat.mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < weights.count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)
      expect(sum).toBeCloseTo(1, 5)
    }
  })

  it('has vertex colors for every vertex', () => {
    const geo = cat.mesh.geometry
    expect(geo.getAttribute('color').count).toBe(geo.getAttribute('position').count)
  })
})

describe('idle clip', () => {
  const cat = buildCat(COAT_PRESETS[0])
  const idle = cat.clips.find((c) => c.name === 'idle')

  it('exists and only targets real bones', () => {
    expect(idle).toBeDefined()
    const names = new Set<string>(BONES.map((b) => b.name))
    for (const track of idle?.tracks ?? []) {
      expect(names.has(track.name.split('.')[0])).toBe(true)
    }
  })

  it('covers breathing, tail, ears and blinking', () => {
    const tracks = new Set(idle?.tracks.map((t) => t.name))
    for (const name of ['torso.scale', 'tail3.quaternion', 'earL.quaternion', 'eyeL.scale']) {
      expect(tracks.has(name)).toBe(true)
    }
  })

  it('loops seamlessly (first and last keyframes match)', () => {
    for (const track of idle?.tracks ?? []) {
      const size = track.getValueSize()
      const first = Array.from(track.values.slice(0, size))
      const last = Array.from(track.values.slice(-size))
      first.forEach((v, i) => expect(last[i]).toBeCloseTo(v, 5))
    }
    expect(idle?.duration).toBe(IDLE.duration)
  })
})

describe('all clips', () => {
  const cat = buildCat(COAT_PRESETS[0])
  const boneNames = new Set<string>(BONES.map((b) => b.name))
  const byName = new Map(cat.clips.map((c) => [c.name, c]))

  /** Rest value per track type: identity rotation, unit scale, zero root offset. */
  const rest = (trackName: string): number[] =>
    trackName.endsWith('.quaternion')
      ? [0, 0, 0, 1]
      : trackName.endsWith('.scale')
        ? [1, 1, 1]
        : [0, 0, 0]

  const firstLast = (values: ArrayLike<number>, size: number): [number[], number[]] => [
    Array.from(values).slice(0, size),
    Array.from(values).slice(-size)
  ]

  it('provides every standard clip', () => {
    expect([...byName.keys()].sort()).toEqual([...STANDARD_CLIPS].sort())
  })

  it('only targets real bones', () => {
    for (const clip of cat.clips) {
      for (const track of clip.tracks) expect(boneNames.has(track.name.split('.')[0])).toBe(true)
    }
  })

  it.each(['idle', 'walk', 'drag', 'sleep'])('%s loops seamlessly', (name) => {
    for (const track of byName.get(name)?.tracks ?? []) {
      const [first, last] = firstLast(track.values, track.getValueSize())
      first.forEach((v, i) => expect(last[i]).toBeCloseTo(v, 5))
    }
  })

  it.each(['click', 'land'])('%s starts and ends at the rest pose', (name) => {
    for (const track of byName.get(name)?.tracks ?? []) {
      const [first, last] = firstLast(track.values, track.getValueSize())
      const expected = rest(track.name)
      first.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5))
      last.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5))
    }
  })
})

describe('pulse', () => {
  it('is zero outside its window and peaks in the middle', () => {
    expect(pulse(0.9, 1, 0.2)).toBe(0)
    expect(pulse(1.3, 1, 0.2)).toBe(0)
    expect(pulse(1.1, 1, 0.2)).toBeCloseTo(1)
  })
})
