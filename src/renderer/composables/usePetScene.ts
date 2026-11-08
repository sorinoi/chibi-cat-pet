import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { RENDER } from '../config'
import { frameAt } from '../lib/spriteTimeline'
import { spriteLayout, toCell, type SpriteLayout } from '../lib/spriteLayout'
import { spriteSheetUrl } from '../models/registry'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import {
  modelFrame,
  resolveClip,
  type ClipName,
  type SpriteClip,
  type SpriteSheet
} from '../../shared/modelConfig'

export type Facing = 'left' | 'right'

export interface PetScene {
  /** True when the pixel under the point (client CSS pixels) is part of the cat. */
  hitTest(clientX: number, clientY: number): boolean
  /**
   * Starts a clip from its first frame. Safe to call before the sheets load. `once` plays a
   * looping clip a single time (intro + one loop) and then reports it finished.
   */
  play(clip: ClipName, options?: { once?: boolean }): void
  /** Which way the cat faces; frames are mirrored for the direction the sheet does not draw. */
  setFacing(facing: Facing): void
  /** Called when a non-looping clip reaches its end. */
  onClipFinished(listener: (clip: ClipName) => void): void
  /** Called after every drawn frame. */
  onFrame(listener: () => void): void
  /** What is on screen now (for debugging). */
  current(): { clip: ClipName; frame: number; facing: Facing }
}

/** A decoded sheet plus its alpha channel (row-major) for hit tests. */
interface LoadedSheet {
  spec: SpriteSheet
  image: HTMLImageElement
  alpha: Uint8Array
}

async function loadSheet(spec: SpriteSheet): Promise<LoadedSheet> {
  const image = new Image()
  image.src = spriteSheetUrl(spec.file)
  await image.decode()
  const { naturalWidth: w, naturalHeight: h } = image
  if (w !== spec.columns * spec.cellWidth || h !== spec.rows * spec.cellHeight) {
    console.warn(
      `${spec.file} is ${w}x${h}, config expects ${spec.columns * spec.cellWidth}x${spec.rows * spec.cellHeight}`
    )
  }
  const scratch = new OffscreenCanvas(w, h)
  const scratchCtx = scratch.getContext('2d')
  if (!scratchCtx) throw new Error('2D context unavailable')
  scratchCtx.drawImage(image, 0, 0)
  const rgba = scratchCtx.getImageData(0, 0, w, h).data
  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
  return { spec, image, alpha }
}

/**
 * Draws the pet from its sprite sheets on a 2D canvas (no WebGL).
 * Frames advance on a timer at each frame's own duration, so nothing runs between
 * frame changes; idle CPU stays near zero (NFR-01, NFR-02). Every sheet's feet anchor
 * lands on the same point, so switching between sheets does not move the cat.
 */
export function usePetScene(canvas: Ref<HTMLCanvasElement | null>): PetScene {
  const model = ACTIVE_MODEL
  const frame = modelFrame(model)

  let ctx: CanvasRenderingContext2D | null = null
  const sheets = new Map<string, LoadedSheet>()
  let layout: SpriteLayout | null = null
  let removeDprListener: (() => void) | null = null
  let disposed = false

  let clipName: ClipName = 'idle'
  let clip: SpriteClip = model.clips.idle
  let startedAt = 0
  let shownFrame = 0
  let finishedSent = false
  let timer: ReturnType<typeof setTimeout> | null = null
  /** When the page became hidden, while paused. */
  let pausedAt: number | null = null
  let facing: Facing = model.walkFacing

  const finishedListeners: Array<(clip: ClipName) => void> = []
  const frameListeners: Array<() => void> = []

  function draw(): void {
    const el = canvas.value
    if (!ctx || !el) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, el.width, el.height)
    const sheet = sheets.get(clip.sheet)
    if (!sheet) return
    const { cellWidth, cellHeight } = sheet.spec
    layout = spriteLayout(el.width, el.height, frame, sheet.spec, facing !== model.walkFacing)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.setTransform(layout.sign * layout.scale, 0, 0, layout.scale, layout.originX, layout.originY)
    ctx.drawImage(
      sheet.image,
      (clip.column + shownFrame) * cellWidth,
      clip.row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight
    )
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    frameListeners.forEach((fn) => fn())
  }

  function tick(): void {
    if (timer) clearTimeout(timer)
    timer = null
    if (disposed) return
    // FR-16: while hidden (tray, fullscreen app) the clock stops; resume continues the clip.
    if (document.hidden) {
      pausedAt ??= performance.now()
      return
    }
    const state = frameAt(clip, performance.now() - startedAt)
    if (state.frame !== shownFrame) {
      shownFrame = state.frame
      draw()
    }
    if (state.finished && !finishedSent) {
      finishedSent = true
      finishedListeners.forEach((fn) => fn(clipName))
    }
    if (state.nextChangeMs !== null) timer = setTimeout(tick, state.nextChangeMs)
  }

  function play(name: ClipName, options?: { once?: boolean }): void {
    // Missing optional clips fall back (e.g. focus reactions before their art exists).
    const next = model.clips[resolveClip(name, model.clips)]
    if (!next) console.warn(`Model ${model.id} has no "${name}" clip; showing idle`)
    clipName = name
    const base = next ?? model.clips.idle
    clip = options?.once ? { ...base, loop: false } : base
    startedAt = performance.now()
    pausedAt = null
    finishedSent = false
    shownFrame = 0
    draw()
    tick()
    // A missing one-shot clip must still finish, or the state machine would get stuck.
    if (!next && name !== 'idle') finishedListeners.forEach((fn) => fn(name))
  }

  function onVisibilityChange(): void {
    if (document.hidden || pausedAt === null) {
      tick()
      return
    }
    startedAt += performance.now() - pausedAt
    pausedAt = null
    tick()
  }

  function resize(): void {
    const el = canvas.value
    if (!el) return
    const dpr = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio)
    el.width = Math.max(1, Math.round(el.clientWidth * dpr))
    el.height = Math.max(1, Math.round(el.clientHeight * dpr))
    draw()
  }

  /** Re-arm a media query so moving to a monitor with another DPI triggers a redraw. */
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

  async function loadAll(): Promise<void> {
    const entries = Object.entries(model.sheets)
    const loaded = await Promise.all(entries.map(([, spec]) => loadSheet(spec)))
    if (disposed) return
    entries.forEach(([name], i) => sheets.set(name, loaded[i]))
    draw()
    // NFR-03: one mark per launch, read by the startup measurement (never repeated, no growth).
    performance.mark('pet:first-frame')
  }

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    ctx = el.getContext('2d')
    resize()
    watchPixelRatio()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('resize', resize)
    loadAll().catch((err: unknown) => console.error('Failed to load sprite sheets:', err))
  })

  onBeforeUnmount(() => {
    disposed = true
    if (timer) clearTimeout(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('resize', resize)
    removeDprListener?.()
    finishedListeners.length = 0
    frameListeners.length = 0
    sheets.clear()
    ctx = null
  })

  return {
    hitTest(clientX, clientY) {
      const el = canvas.value
      const sheet = sheets.get(clip.sheet)
      if (!el || !sheet || !layout) return false
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const x = (clientX - rect.left) * (el.width / rect.width)
      const y = (clientY - rect.top) * (el.height / rect.height)
      const { u, v } = toCell(layout, x, y)
      const cu = Math.floor(u)
      const cv = Math.floor(v)
      const { cellWidth, cellHeight, columns } = sheet.spec
      if (cu < 0 || cv < 0 || cu >= cellWidth || cv >= cellHeight) return false
      const sx = (clip.column + shownFrame) * cellWidth + cu
      const sy = clip.row * cellHeight + cv
      return sheet.alpha[sy * columns * cellWidth + sx] > RENDER.hitAlphaThreshold
    },
    play,
    setFacing(next) {
      if (next === facing) return
      facing = next
      draw()
    },
    onClipFinished(listener) {
      finishedListeners.push(listener)
    },
    onFrame(listener) {
      frameListeners.push(listener)
    },
    current() {
      return { clip: clipName, frame: shownFrame, facing }
    }
  }
}
