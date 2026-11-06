import type { StandardClip } from '../shared/modelConfig'

/** Renderer constants. Keep timings, sizes and colors here, not in components. */
export const RENDER = {
  /** NFR-02 frame cap. */
  maxFps: 30,
  /** Lower cap while asleep: only slow breathing moves. */
  sleepFps: 12,
  /** Largest animation step after a stall, in seconds. */
  maxDeltaSeconds: 0.1,
  /** Upper bound for devicePixelRatio to keep GPU cost sane on 200% displays. */
  maxPixelRatio: 2
} as const

export const PET = {
  /** Model id from assets/models/*.json. Becomes a setting in M4. */
  defaultModelId: 'cat-orange-tabby',
  /** Resting yaw so the cat reads as 3D (radians, + turns it to its left). */
  viewYaw: 0.6,
  /** Yaw while walking right / left across the screen. */
  walkYaw: { right: Math.PI / 2, left: -Math.PI / 2 },
  /** How fast the cat turns, radians per second. */
  turnSpeed: 7
} as const

export const BEHAVIOR = {
  /** Idle time before the cat wanders off on its own (FR-06), seconds. */
  wanderDelaySeconds: { min: 20, max: 60 },
  /** Walk distance in DIP; the direction is random. */
  walkDistance: { min: 120, max: 420 },
  /** DIP per second, roughly matched to the walk clip's stride. */
  walkSpeed: 75,
  /** Pointer travel (DIP) before a press becomes a drag instead of a click. */
  dragThreshold: 4
} as const

/** How each standard clip plays and how quickly it blends in. */
export const CLIP_PLAYBACK: Record<StandardClip, { loop: boolean; fadeSeconds: number }> = {
  idle: { loop: true, fadeSeconds: 0.3 },
  walk: { loop: true, fadeSeconds: 0.2 },
  // Short fade so the reaction starts well within NFR-04's 100 ms.
  click: { loop: false, fadeSeconds: 0.08 },
  drag: { loop: true, fadeSeconds: 0.12 },
  land: { loop: false, fadeSeconds: 0.08 },
  sleep: { loop: true, fadeSeconds: 0.8 }
}

export const CAMERA = {
  fov: 30,
  near: 0.1,
  far: 100,
  position: [0, 1.05, 3.0] as const,
  lookAt: [0, 0.5, 0] as const
} as const

export const LIGHTS = {
  hemisphere: { sky: 0xffffff, ground: 0x8a7a6a, intensity: 2.2 },
  sun: { color: 0xffffff, intensity: 1.6, position: [2, 4, 3] as const }
} as const
