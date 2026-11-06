import {
  AnimationClip,
  Euler,
  KeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack
} from 'three'
import type { BoneName } from './parts.mts'

/** Keyframe sampling rate for baked procedural clips. */
export const SAMPLE_FPS = 30

const TAU = Math.PI * 2

type Vec3Fn = (t: number) => readonly [number, number, number]

function sampleTimes(duration: number): number[] {
  const frames = Math.round(duration * SAMPLE_FPS)
  return Array.from({ length: frames + 1 }, (_, i) => (i / frames) * duration)
}

/** Euler XYZ rotation (radians) relative to the bone's identity rest pose. */
function rotationTrack(bone: BoneName, duration: number, fn: Vec3Fn): KeyframeTrack {
  const times = sampleTimes(duration)
  const q = new Quaternion()
  const e = new Euler()
  const values = times.flatMap((t) => {
    const [x, y, z] = fn(t)
    q.setFromEuler(e.set(x, y, z))
    return [q.x, q.y, q.z, q.w]
  })
  return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values)
}

function vectorTrack(
  bone: BoneName,
  property: 'scale' | 'position',
  duration: number,
  fn: Vec3Fn
): KeyframeTrack {
  const times = sampleTimes(duration)
  return new VectorKeyframeTrack(
    `${bone}.${property}`,
    times,
    times.flatMap((t) => [...fn(t)])
  )
}

const scaleTrack = (bone: BoneName, d: number, fn: Vec3Fn): KeyframeTrack =>
  vectorTrack(bone, 'scale', d, fn)

/** The root bone rests at the origin, so its position track is an absolute offset. */
const rootOffsetTrack = (d: number, fn: Vec3Fn): KeyframeTrack =>
  vectorTrack('root', 'position', d, fn)

/** Smooth 0 -> 1 -> 0 bump over [start, start + length], zero elsewhere. */
export function pulse(t: number, start: number, length: number): number {
  if (t < start || t > start + length) return 0
  return Math.sin(((t - start) / length) * Math.PI)
}

/** Uniform squash (amount > 0) or stretch (amount < 0) that keeps volume roughly constant. */
function squash(amount: number): readonly [number, number, number] {
  return [1 + amount * 0.6, 1 - amount, 1 + amount * 0.6]
}

const TAIL_BONES = ['tail0', 'tail1', 'tail2', 'tail3'] as const
const LEGS = { front: ['legFL', 'legFR'], back: ['legBL', 'legBR'] } as const

// ---------------------------------------------------------------------------
// idle (loop): breathing, tail sway, ear twitch, blink. All periods divide the duration.

export const IDLE = {
  duration: 6,
  breathPeriod: 3,
  breathScale: [0.012, 0.03, 0.015] as const,
  headNod: 0.035,
  tailPeriod: 3,
  tailSway: [0.12, 0.16, 0.2, 0.24] as const,
  tailCurl: 0.05,
  tailLag: 0.6,
  earTwitch: 0.45,
  earTwitches: { earL: [1.4], earR: [4.1, 4.45] } as const,
  earTwitchLength: 0.25,
  blinks: [2.2, 5.3] as const,
  blinkLength: 0.22,
  blinkDepth: 0.9
} as const

export function createIdleClip(): AnimationClip {
  const d = IDLE.duration
  const tracks: KeyframeTrack[] = []

  tracks.push(
    scaleTrack('torso', d, (t) => {
      const s = Math.sin((TAU * t) / IDLE.breathPeriod)
      const [x, y, z] = IDLE.breathScale
      return [1 + x * s, 1 + y * s, 1 + z * s]
    })
  )

  tracks.push(
    rotationTrack('head', d, (t) => [
      IDLE.headNod * Math.sin((TAU * t) / d),
      0,
      0.5 * IDLE.headNod * Math.sin((TAU * t) / IDLE.breathPeriod + 1)
    ])
  )

  TAIL_BONES.forEach((bone, i) => {
    tracks.push(
      rotationTrack(bone, d, (t) => {
        const phase = (TAU * t) / IDLE.tailPeriod - i * IDLE.tailLag
        return [IDLE.tailCurl * Math.cos(phase), IDLE.tailSway[i] * Math.sin(phase), 0]
      })
    )
  })

  for (const [bone, side] of [
    ['earL', 1],
    ['earR', -1]
  ] as const) {
    const starts = IDLE.earTwitches[bone]
    tracks.push(
      rotationTrack(bone, d, (t) => {
        const p = starts.reduce((sum, s) => sum + pulse(t, s, IDLE.earTwitchLength), 0)
        return [-0.3 * IDLE.earTwitch * p, 0, -side * IDLE.earTwitch * p]
      })
    )
  }

  for (const bone of ['eyeL', 'eyeR'] as const) {
    tracks.push(
      scaleTrack(bone, d, (t) => {
        const p = IDLE.blinks.reduce((sum, s) => sum + pulse(t, s, IDLE.blinkLength), 0)
        return [1, 1 - IDLE.blinkDepth * p, 1]
      })
    )
  }

  return new AnimationClip('idle', d, tracks)
}

// ---------------------------------------------------------------------------
// walk (loop): diagonal leg pairs, body bob, light tail sway.

export const WALK = {
  duration: 0.8,
  legSwing: 0.42,
  bob: 0.012,
  headBob: 0.03,
  tailSway: 0.1
} as const

export function createWalkClip(): AnimationClip {
  const d = WALK.duration
  const phase = (t: number): number => (TAU * t) / d
  const tracks: KeyframeTrack[] = []

  // FL + BR move together, FR + BL opposite (a trot-like gait).
  const legPhase: Record<string, number> = { legFL: 0, legBR: 0, legFR: Math.PI, legBL: Math.PI }
  for (const [bone, offset] of Object.entries(legPhase)) {
    tracks.push(
      rotationTrack(bone as BoneName, d, (t) => [WALK.legSwing * Math.sin(phase(t) + offset), 0, 0])
    )
  }
  tracks.push(rootOffsetTrack(d, (t) => [0, WALK.bob * (1 - Math.cos(2 * phase(t))), 0]))
  tracks.push(rotationTrack('head', d, (t) => [WALK.headBob * Math.sin(2 * phase(t)), 0, 0]))
  TAIL_BONES.forEach((bone, i) => {
    tracks.push(rotationTrack(bone, d, (t) => [0, WALK.tailSway * Math.sin(phase(t) - i * 0.5), 0]))
  })

  return new AnimationClip('walk', d, tracks)
}

// ---------------------------------------------------------------------------
// click (once): anticipation squash, happy hop, tail up, head tilt. Starts and ends at rest.

export const CLICK = {
  duration: 0.9,
  hopHeight: 0.1,
  squash: 0.1,
  stretch: 0.06,
  tailLift: 0.45,
  headTilt: 0.18,
  earFlick: 0.35,
  squint: 0.5
} as const

export function createClickClip(): AnimationClip {
  const d = CLICK.duration
  const tracks: KeyframeTrack[] = []

  tracks.push(rootOffsetTrack(d, (t) => [0, CLICK.hopHeight * pulse(t, 0.15, 0.4), 0]))
  tracks.push(
    scaleTrack('root', d, (t) =>
      squash(
        CLICK.squash * pulse(t, 0, 0.15) -
          CLICK.stretch * pulse(t, 0.15, 0.4) +
          CLICK.squash * pulse(t, 0.55, 0.2)
      )
    )
  )
  TAIL_BONES.forEach((bone, i) => {
    tracks.push(
      rotationTrack(bone, d, (t) => [(CLICK.tailLift / (i + 1)) * pulse(t, 0.1, 0.7), 0, 0])
    )
  })
  tracks.push(rotationTrack('head', d, (t) => [0, 0, CLICK.headTilt * pulse(t, 0.1, 0.7)]))
  for (const [bone, side] of [
    ['earL', 1],
    ['earR', -1]
  ] as const) {
    tracks.push(rotationTrack(bone, d, (t) => [0, 0, -side * CLICK.earFlick * pulse(t, 0.1, 0.3)]))
  }
  for (const bone of ['eyeL', 'eyeR'] as const) {
    tracks.push(scaleTrack(bone, d, (t) => [1, 1 - CLICK.squint * pulse(t, 0.45, 0.35), 1]))
  }

  return new AnimationClip('click', d, tracks)
}

// ---------------------------------------------------------------------------
// drag (loop): picked up, legs dangle and sway, tail hangs down, ears back.

export const DRAG = {
  duration: 1.6,
  frontLegs: -0.3,
  backLegs: 0.35,
  legSway: 0.12,
  tailHang: [-0.9, -0.35, -0.2, -0.1] as const,
  tailSway: 0.15,
  earsBack: 0.35,
  stretch: 0.04
} as const

export function createDragClip(): AnimationClip {
  const d = DRAG.duration
  const phase = (t: number): number => (TAU * t) / d
  const tracks: KeyframeTrack[] = []

  for (const bone of LEGS.front) {
    tracks.push(
      rotationTrack(bone, d, (t) => [DRAG.frontLegs + DRAG.legSway * Math.sin(phase(t)), 0, 0])
    )
  }
  for (const bone of LEGS.back) {
    tracks.push(
      rotationTrack(bone, d, (t) => [
        DRAG.backLegs + DRAG.legSway * Math.sin(phase(t) + Math.PI),
        0,
        0
      ])
    )
  }
  TAIL_BONES.forEach((bone, i) => {
    tracks.push(
      rotationTrack(bone, d, (t) => [
        DRAG.tailHang[i],
        DRAG.tailSway * Math.sin(phase(t) - i * 0.6),
        0
      ])
    )
  })
  for (const [bone, side] of [
    ['earL', 1],
    ['earR', -1]
  ] as const) {
    tracks.push(rotationTrack(bone, d, () => [-DRAG.earsBack, 0, -side * DRAG.earsBack]))
  }
  tracks.push(scaleTrack('torso', d, () => squash(-DRAG.stretch)))

  return new AnimationClip('drag', d, tracks)
}

// ---------------------------------------------------------------------------
// land (once): squash on impact, small rebound. Starts and ends at rest.

export const LAND = {
  duration: 0.6,
  squash: 0.16,
  rebound: 0.05,
  tailDip: 0.3,
  earDip: 0.25
} as const

export function createLandClip(): AnimationClip {
  const d = LAND.duration
  const tracks: KeyframeTrack[] = []

  tracks.push(
    scaleTrack('root', d, (t) =>
      squash(LAND.squash * pulse(t, 0, 0.3) - LAND.rebound * pulse(t, 0.3, 0.2))
    )
  )
  tracks.push(rotationTrack('tail0', d, (t) => [-LAND.tailDip * pulse(t, 0, 0.5), 0, 0]))
  for (const [bone, side] of [
    ['earL', 1],
    ['earR', -1]
  ] as const) {
    tracks.push(rotationTrack(bone, d, (t) => [0, 0, -side * LAND.earDip * pulse(t, 0, 0.4)]))
  }

  return new AnimationClip('land', d, tracks)
}

// ---------------------------------------------------------------------------
// sleep (loop): lying down sphinx-style, head down, eyes shut, tail curled, slow breathing.

export const SLEEP = {
  duration: 4,
  lower: -0.26,
  frontLegs: -1.45,
  /** Back legs fold forward and shorten so they tuck under the body. */
  backLegs: -1.4,
  backLegTuck: 0.5,
  head: [0.45, 0.25, 0.05] as const,
  eyesClosed: 0.12,
  ears: -0.15,
  /** [x, y] rotation per tail bone: down to the floor, then wrapping around the side. */
  tailCurl: [
    [-1.1, 1.1],
    [-0.1, 0.8],
    [0, 0.75],
    [0, 0.6]
  ] as const,
  tipSway: 0.08,
  breath: 0.04
} as const

export function createSleepClip(): AnimationClip {
  const d = SLEEP.duration
  const phase = (t: number): number => (TAU * t) / d
  const tracks: KeyframeTrack[] = []

  tracks.push(rootOffsetTrack(d, () => [0, SLEEP.lower, 0]))
  for (const bone of LEGS.front) tracks.push(rotationTrack(bone, d, () => [SLEEP.frontLegs, 0, 0]))
  for (const bone of LEGS.back) {
    tracks.push(rotationTrack(bone, d, () => [SLEEP.backLegs, 0, 0]))
    tracks.push(scaleTrack(bone, d, () => [1, SLEEP.backLegTuck, 1]))
  }
  tracks.push(
    rotationTrack('head', d, (t) => [
      SLEEP.head[0] + 0.02 * Math.sin(phase(t)),
      SLEEP.head[1],
      SLEEP.head[2]
    ])
  )
  for (const bone of ['eyeL', 'eyeR'] as const) {
    tracks.push(scaleTrack(bone, d, () => [1, SLEEP.eyesClosed, 1]))
  }
  for (const bone of ['earL', 'earR'] as const) {
    tracks.push(rotationTrack(bone, d, () => [SLEEP.ears, 0, 0]))
  }
  TAIL_BONES.forEach((bone, i) => {
    const [x, y] = SLEEP.tailCurl[i]
    const sway = i === TAIL_BONES.length - 1 ? SLEEP.tipSway : 0
    tracks.push(rotationTrack(bone, d, (t) => [x, y + sway * Math.sin(phase(t)), 0]))
  })
  tracks.push(
    scaleTrack('torso', d, (t) => {
      const s = Math.sin(phase(t))
      return [1 + 0.4 * SLEEP.breath * s, 1 + SLEEP.breath * s, 1 + 0.3 * SLEEP.breath * s]
    })
  )

  return new AnimationClip('sleep', d, tracks)
}

/** All clips baked into the model, named after the standard clip names. */
export function createAllClips(): AnimationClip[] {
  return [
    createIdleClip(),
    createWalkClip(),
    createClickClip(),
    createDragClip(),
    createLandClip(),
    createSleepClip()
  ]
}
