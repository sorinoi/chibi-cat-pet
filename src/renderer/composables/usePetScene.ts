import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { RENDER } from '../config'
import { frameAt } from '../lib/spriteTimeline'
import { spriteLayout, toCell, type SpriteLayout } from '../lib/spriteLayout'
import { spriteSheetUrl } from '../models/registry'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import type { SpriteClip, StandardClip } from '../../shared/modelConfig'

export type Facing = 'left' | 'right'

export interface PetScene {
  /** True when the pixel under the point (client CSS pixels) is part of the cat. */
  hitTest(clientX: number, clientY: number): boolean
  /** Starts a standard clip from its first frame. Safe to call before the sheet loads. */
  play(clip: StandardClip): void
  /** Which way the cat faces; frames are mirrored for the direction the sheet does not draw. */
  setFacing(facing: Facing): void
  /** Called when a non-looping clip reaches its end. */
  onClipFinished(listener: (clip: StandardClip) => void): void
  /** Called after every drawn frame. */
  onFrame(listener: () => void): void
  /** What is on screen now (for debugging). */
  current(): { clip: StandardClip; frame: number; facing: Facing }
}

/**
 * Draws the pet from its sprite sheet on a 2D canvas (no WebGL).
 * Frames advance on a timer at each frame's own duration, so nothing runs between
 * frame changes; idle CPU stays near zero (NFR-01, NFR-02).
 */
export function usePetScene(canvas: Ref<HTMLCanvasElement | null>): PetScene {
  const model = ACTIVE_MODEL
  const { cellWidth, cellHeight } = model.sheet

  let ctx: CanvasRenderingContext2D | null = null
  let sheet: HTMLImageElement | null = null
  /** Alpha channel of the whole sheet, row-major, for hit tests. */
  let alpha: Uint8Array | null = null
  let sheetWidth = 0
  let layout: SpriteLayout | null = null
  let removeDprListener: (() => void) | null = null
  let disposed = false

  let clipName: StandardClip = 'idle'
  let clip: SpriteClip = model.clips.idle
  let startedAt = 0
  let shownFrame = 0
  let finishedSent = false
  let timer: ReturnType<typeof setTimeout> | null = null
  /** When the page became hidden, while paused. */
  let pausedAt: number | null = null
  let facing: Facing = model.walkFacing

  const finishedListeners: Array<(clip: StandardClip) => void> = []
  const frameListeners: Array<() => void> = []

  function draw(): void {
    const el = canvas.value
    if (!ctx || !el) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, el.width, el.height)
    if (!sheet) return
    layout = spriteLayout(el.width, el.height, model, facing !== model.walkFacing)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.setTransform(layout.sign * layout.scale, 0, 0, layout.scale, layout.originX, layout.originY)
    ctx.drawImage(
      sheet,
      shownFrame * cellWidth,
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

  function play(name: StandardClip): void {
    const next = model.clips[name]
    if (!next) console.warn(`Model ${model.id} has no "${name}" clip; showing idle`)
    clipName = name
    clip = next ?? model.clips.idle
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

  async function loadSheet(): Promise<void> {
    const img = new Image()
    img.src = spriteSheetUrl(model.file)
    await img.decode()
    if (disposed) return
    const { columns, rows } = model.sheet
    if (img.naturalWidth !== columns * cellWidth || img.naturalHeight !== rows * cellHeight) {
      console.warn(
        `Sprite sheet is ${img.naturalWidth}x${img.naturalHeight}, config expects ${columns * cellWidth}x${rows * cellHeight}`
      )
    }
    const scratch = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
    const scratchCtx = scratch.getContext('2d')
    if (!scratchCtx) throw new Error('2D context unavailable')
    scratchCtx.drawImage(img, 0, 0)
    const rgba = scratchCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data
    const a = new Uint8Array(img.naturalWidth * img.naturalHeight)
    for (let i = 0; i < a.length; i++) a[i] = rgba[i * 4 + 3]
    alpha = a
    sheetWidth = img.naturalWidth
    sheet = img
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
    loadSheet().catch((err: unknown) => console.error('Failed to load sprite sheet:', err))
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
    sheet = null
    alpha = null
    ctx = null
  })

  return {
    hitTest(clientX, clientY) {
      const el = canvas.value
      if (!el || !alpha || !layout) return false
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const x = (clientX - rect.left) * (el.width / rect.width)
      const y = (clientY - rect.top) * (el.height / rect.height)
      const { u, v } = toCell(layout, x, y)
      const cu = Math.floor(u)
      const cv = Math.floor(v)
      if (cu < 0 || cv < 0 || cu >= cellWidth || cv >= cellHeight) return false
      const sx = shownFrame * cellWidth + cu
      const sy = clip.row * cellHeight + cv
      return alpha[sy * sheetWidth + sx] > RENDER.hitAlphaThreshold
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
