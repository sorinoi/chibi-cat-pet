<script setup lang="ts">
/**
 * Fed and happy over time (FR-96): two 2px lines on one 0..100 axis, legend plus end labels,
 * crosshair and tooltip on hover.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { NeedsPoint } from '../../../src/dashTypes.ts'
import { formatDateTime, formatDay } from '../format.ts'

const props = defineProps<{
  points: NeedsPoint[]
  from: number
  to: number
  days: string[]
  labels: { hunger: string; happiness: string }
  locale: string
  timeZone: string
}>()

const HEIGHT = 220
const PAD = { left: 34, right: 64, top: 12, bottom: 26 }
const box = ref<HTMLDivElement | null>(null)
const width = ref(640)
const hover = ref<NeedsPoint | null>(null)
let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(280, entry.contentRect.width)
  })
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = HEIGHT - PAD.top - PAD.bottom
const x = (t: number): number =>
  PAD.left + ((t - props.from) / Math.max(1, props.to - props.from)) * plotW.value
const y = (v: number): number => PAD.top + (1 - v / 100) * plotH

const path = (key: 'hunger' | 'happiness'): string =>
  props.points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p[key]).toFixed(1)}`)
    .join('')

/** Up to about 7 day labels, evenly spread, always including today. */
const ticks = computed(() => {
  const step = Math.max(1, Math.ceil(props.days.length / 7))
  return props.days
    .filter((_, i) => (props.days.length - 1 - i) % step === 0)
    .map((day) => {
      return { day, label: formatDay(day, props.locale) }
    })
})
const tickX = (day: string): number => {
  const i = props.days.indexOf(day)
  return PAD.left + ((i + 0.5) / Math.max(1, props.days.length)) * plotW.value
}

const last = computed(() => props.points.at(-1) ?? null)

function onMove(event: PointerEvent): void {
  if (props.points.length === 0) return
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  const px = event.clientX - rect.left + PAD.left
  let best = props.points[0] ?? null
  for (const p of props.points)
    if (best && Math.abs(x(p.at) - px) < Math.abs(x(best.at) - px)) best = p
  hover.value = best
}
</script>

<template>
  <div ref="box" class="chart">
    <div class="legend">
      <span><i class="swatch s1"></i>{{ labels.hunger }}</span>
      <span><i class="swatch s2"></i>{{ labels.happiness }}</span>
    </div>
    <svg
      :width="width"
      :height="HEIGHT"
      role="img"
      :aria-label="`${labels.hunger}, ${labels.happiness}`"
    >
      <g class="grid">
        <line
          v-for="v in [0, 50, 100]"
          :key="v"
          :x1="PAD.left"
          :x2="PAD.left + plotW"
          :y1="y(v)"
          :y2="y(v)"
        />
        <text
          v-for="v in [0, 50, 100]"
          :key="`l${v}`"
          :x="PAD.left - 6"
          :y="y(v) + 4"
          text-anchor="end"
        >
          {{ v }}
        </text>
        <text
          v-for="tk in ticks"
          :key="tk.day"
          :x="tickX(tk.day)"
          :y="HEIGHT - 8"
          text-anchor="middle"
        >
          {{ tk.label }}
        </text>
      </g>
      <path class="line s1" :d="path('hunger')" />
      <path class="line s2" :d="path('happiness')" />
      <template v-if="last">
        <circle class="dot s1" :cx="x(last.at)" :cy="y(last.hunger)" r="4" />
        <circle class="dot s2" :cx="x(last.at)" :cy="y(last.happiness)" r="4" />
        <text class="end" :x="x(last.at) + 8" :y="y(last.hunger) + 4">
          {{ Math.round(last.hunger) }}
        </text>
        <text
          class="end"
          :x="x(last.at) + 8"
          :y="y(last.happiness) + (last.happiness > last.hunger ? -6 : 14)"
        >
          {{ Math.round(last.happiness) }}
        </text>
      </template>
      <template v-if="hover">
        <line
          class="cross"
          :x1="x(hover.at)"
          :x2="x(hover.at)"
          :y1="PAD.top"
          :y2="PAD.top + plotH"
        />
        <circle class="dot s1" :cx="x(hover.at)" :cy="y(hover.hunger)" r="4" />
        <circle class="dot s2" :cx="x(hover.at)" :cy="y(hover.happiness)" r="4" />
      </template>
      <rect
        class="hit"
        :x="PAD.left"
        :y="PAD.top"
        :width="plotW"
        :height="plotH"
        @pointermove="onMove"
        @pointerleave="hover = null"
      />
    </svg>
    <div
      v-if="hover"
      class="tip"
      :style="{ left: `${Math.min(x(hover.at) + 12, width - 190)}px`, top: `${PAD.top + 8}px` }"
    >
      <div class="tip-time">{{ formatDateTime(hover.at, locale, timeZone) }}</div>
      <div>
        <i class="swatch s1"></i>{{ labels.hunger }} <b>{{ Math.round(hover.hunger) }}</b>
      </div>
      <div>
        <i class="swatch s2"></i>{{ labels.happiness }} <b>{{ Math.round(hover.happiness) }}</b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.legend {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: -1px;
}
.swatch.s1 {
  background: var(--series-1);
}
.swatch.s2 {
  background: var(--series-2);
}
svg {
  display: block;
  overflow: visible;
}
.grid line {
  stroke: var(--grid);
  stroke-width: 1;
}
.grid text,
.end {
  fill: var(--text-muted);
  font-size: 11px;
}
.end {
  fill: var(--text-secondary);
  font-weight: 600;
}
.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.line.s1 {
  stroke: var(--series-1);
}
.line.s2 {
  stroke: var(--series-2);
}
.dot {
  stroke: var(--surface);
  stroke-width: 2;
}
.dot.s1 {
  fill: var(--series-1);
}
.dot.s2 {
  fill: var(--series-2);
}
.cross {
  stroke: var(--text-muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.hit {
  fill: transparent;
  cursor: crosshair;
}
.tip {
  position: absolute;
  pointer-events: none;
  min-width: 170px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgb(0 0 0 / 12%);
}
.tip-time {
  color: var(--text-secondary);
}
</style>
