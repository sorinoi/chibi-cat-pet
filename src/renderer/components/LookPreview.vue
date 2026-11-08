<script setup lang="ts">
/**
 * requirement-v7.md FR-106, FR-107, NFR-41: a small moving preview (idle) of one look, drawn
 * from the look's own main sheet (no extra preview files). Timers only at frame changes; the
 * image is released when the preview goes away.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { frameAt } from '../lib/spriteTimeline'
import { spriteSheetUrl } from '../models/registry'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import { sheetFile } from '../../shared/modelConfig'

const props = defineProps<{ look: string; size: number }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const clip = ACTIVE_MODEL.clips.idle
const spec = ACTIVE_MODEL.sheets[clip.sheet]
let image: HTMLImageElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let startedAt = 0
let shown = -1
let alive = true

function draw(frame: number): void {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx || !image || !spec) return
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    (clip.column + frame) * spec.cellWidth,
    clip.row * spec.cellHeight,
    spec.cellWidth,
    spec.cellHeight,
    0,
    0,
    el.width,
    el.height
  )
}

function tick(): void {
  timer = null
  if (!alive || !image) return
  const state = frameAt(clip, performance.now() - startedAt)
  if (state.frame !== shown) {
    shown = state.frame
    draw(shown)
  }
  if (state.nextChangeMs !== null) timer = setTimeout(tick, state.nextChangeMs)
}

async function load(look: string): Promise<void> {
  if (!spec) return
  if (timer) clearTimeout(timer)
  timer = null
  const next = new Image()
  next.src = spriteSheetUrl(sheetFile(ACTIVE_MODEL, look, clip.sheet))
  await next.decode()
  if (!alive || look !== props.look) return
  if (image) image.src = ''
  image = next
  startedAt = performance.now()
  shown = -1
  tick()
}

onMounted(() => {
  const el = canvas.value
  if (el) {
    const dpr = window.devicePixelRatio
    el.width = Math.round(props.size * dpr)
    el.height = Math.round(props.size * dpr)
  }
  load(props.look).catch((err: unknown) => console.error('Look preview failed:', err))
})
watch(
  () => props.look,
  (look) => void load(look)
)
onBeforeUnmount(() => {
  alive = false
  if (timer) clearTimeout(timer)
  if (image) image.src = ''
  image = null
})
</script>

<template>
  <canvas
    ref="canvas"
    class="look-preview"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>
