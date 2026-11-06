import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { CAMERA, CLIP_PLAYBACK, LIGHTS, PET, RENDER } from '../config'
import { createFrameLimiter, type FrameLimiter } from '../lib/frameLimiter'
import { getModel } from '../models/registry'
import type { StandardClip } from '../../shared/modelConfig'

export interface PetScene {
  /** Raycast hit test in client (CSS pixel) coordinates. */
  hitTest(clientX: number, clientY: number): boolean
  /** Cross-fades to a standard clip. Safe to call before the model has loaded. */
  play(clip: StandardClip): void
  /** Turns the cat smoothly toward `yaw` (radians). */
  setFacing(yaw: number): void
  setMaxFps(fps: number): void
  /** Called when a non-looping clip reaches its end. */
  onClipFinished(listener: (clip: StandardClip) => void): void
  /** Called after every rendered frame. */
  onFrame(listener: () => void): void
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const materials: THREE.Material[] = Array.isArray(obj.material)
        ? obj.material
        : [obj.material]
      materials.forEach((m) => m.dispose())
    }
  })
}

/** Shortest signed angle from `from` to `to`. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/**
 * Owns the Three.js renderer, camera, the pet model and its AnimationMixer.
 * Renders at most RENDER.maxFps (lower while asleep).
 */
export function usePetScene(canvas: Ref<HTMLCanvasElement | null>): PetScene {
  let renderer: THREE.WebGLRenderer | null = null
  let removeDprListener: (() => void) | null = null
  let frameHandle: number | null = null
  let disposed = false
  let limiter: FrameLimiter = createFrameLimiter(RENDER.maxFps, RENDER.maxDeltaSeconds)

  let model: THREE.Object3D | null = null
  let mixer: THREE.AnimationMixer | null = null
  let skinned: THREE.SkinnedMesh[] = []
  const actions = new Map<StandardClip, THREE.AnimationAction>()
  let current: THREE.AnimationAction | null = null
  let desiredClip: StandardClip = 'idle'
  let targetYaw: number = PET.viewYaw

  // Skinned bounds follow the pose; refresh them lazily, at most once per rendered frame.
  let frameCount = 0
  let boundsFrame = -1

  const finishedListeners: Array<(clip: StandardClip) => void> = []
  const frameListeners: Array<() => void> = []

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
  camera.position.set(...CAMERA.position)
  camera.lookAt(...CAMERA.lookAt)

  const { hemisphere, sun } = LIGHTS
  scene.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity))
  const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity)
  sunLight.position.set(...sun.position)
  scene.add(sunLight)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  function updateFacing(delta: number): void {
    if (!model) return
    const diff = angleDelta(model.rotation.y, targetYaw)
    const step = PET.turnSpeed * delta
    model.rotation.y =
      Math.abs(diff) <= step ? targetYaw : model.rotation.y + Math.sign(diff) * step
  }

  function renderFrame(now: number): void {
    frameHandle = requestAnimationFrame(renderFrame)
    const delta = limiter.tick(now)
    if (delta === null || !renderer) return
    mixer?.update(delta)
    updateFacing(delta)
    renderer.render(scene, camera)
    frameCount++
    frameListeners.forEach((fn) => fn())
  }

  function startLoop(): void {
    if (frameHandle !== null) return
    limiter.reset()
    frameHandle = requestAnimationFrame(renderFrame)
  }

  function stopLoop(): void {
    if (frameHandle !== null) cancelAnimationFrame(frameHandle)
    frameHandle = null
  }

  function resize(): void {
    const el = canvas.value
    if (!renderer || !el) return
    const { clientWidth: w, clientHeight: h } = el
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio))
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    if (frameHandle === null) renderer.render(scene, camera)
  }

  /** Re-arm a media query so moving to a monitor with another DPI triggers a resize. */
  function watchPixelRatio(): void {
    removeDprListener?.()
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const onChange = (): void => {
      resize()
      watchPixelRatio()
    }
    mq.addEventListener('change', onChange, { once: true })
    removeDprListener = () => mq.removeEventListener('change', onChange)
  }

  function play(clipName: StandardClip): void {
    desiredClip = clipName
    if (!model || !mixer) return
    const action = actions.get(clipName)
    if (!action) {
      console.warn(`Model has no "${clipName}" clip`)
      return
    }
    const { loop, fadeSeconds } = CLIP_PLAYBACK[clipName]
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = !loop
    if (current && current !== action) action.crossFadeFrom(current, fadeSeconds, false)
    action.play()
    current = action
    startLoop()
  }

  async function loadModel(): Promise<void> {
    const { config, url } = getModel(PET.defaultModelId)
    const gltf = await new GLTFLoader().loadAsync(url)
    if (disposed) {
      disposeObject(gltf.scene)
      return
    }
    model = gltf.scene
    model.scale.setScalar(config.scale)
    model.position.set(...config.anchor)
    model.rotation.y = targetYaw
    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) {
        // Poses (sleep, drag) reach outside the bind-pose bounds; never cull the pet.
        obj.frustumCulled = false
        skinned.push(obj)
      }
    })
    scene.add(model)

    mixer = new THREE.AnimationMixer(model)
    for (const [standard, clipName] of Object.entries(config.clips)) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, clipName)
      if (clip) actions.set(standard as StandardClip, mixer.clipAction(clip))
      else console.warn(`Model ${config.id}: clip "${clipName}" not found`)
    }
    mixer.addEventListener('finished', (event) => {
      for (const [standard, action] of actions) {
        if (action === event.action) finishedListeners.forEach((fn) => fn(standard))
      }
    })
    play(desiredClip)
  }

  function refreshBounds(): void {
    if (boundsFrame === frameCount) return
    boundsFrame = frameCount
    skinned.forEach((mesh) => mesh.computeBoundingSphere())
  }

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    resize()
    watchPixelRatio()
    window.addEventListener('resize', resize)
    loadModel().catch((err: unknown) => console.error('Failed to load pet model:', err))
  })

  onBeforeUnmount(() => {
    disposed = true
    stopLoop()
    window.removeEventListener('resize', resize)
    removeDprListener?.()
    if (mixer && model) {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
    if (model) {
      scene.remove(model)
      disposeObject(model)
    }
    actions.clear()
    skinned = []
    current = null
    mixer = null
    model = null
    renderer?.dispose()
    renderer = null
  })

  return {
    hitTest(clientX, clientY) {
      const el = canvas.value
      if (!el || !model) return false
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      refreshBounds()
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObject(model, true).length > 0
    },
    play,
    setFacing(yaw) {
      targetYaw = yaw
    },
    setMaxFps(fps) {
      limiter = createFrameLimiter(fps, RENDER.maxDeltaSeconds)
    },
    onClipFinished(listener) {
      finishedListeners.push(listener)
    },
    onFrame(listener) {
      frameListeners.push(listener)
    }
  }
}
