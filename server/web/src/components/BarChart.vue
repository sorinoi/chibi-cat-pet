<script setup lang="ts">
/**
 * One series of counts (FR-96): thin bars with a 2px gap, rounded tops on a baseline, a few
 * labels, a tooltip per bar on hover.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  title: string
  total: string
  items: Array<{ key: string; label: string; tip: string; value: number }>
}>()

const HEIGHT = 130
const PAD = { left: 28, right: 8, top: 10, bottom: 22 }
const GAP = 2
const box = ref<HTMLDivElement | null>(null)
const width = ref(320)
const hover = ref<number | null>(null)
let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(200, entry.contentRect.width)
  })
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

/** A round top for the axis: 1, 2, 3, 4, 5, 6, 8, 10, 20 ... */
const top = computed(() => {
  const max = Math.max(1, ...props.items.map((i) => i.value))
  const step = 10 ** Math.floor(Math.log10(max))
  return [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((v) => v >= max) ?? max
})
const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = HEIGHT - PAD.top - PAD.bottom
const slot = computed(() => plotW.value / Math.max(1, props.items.length))
const barW = computed(() => Math.max(2, Math.min(28, slot.value - GAP)))
const barX = (i: number): number => PAD.left + i * slot.value + (slot.value - barW.value) / 2
const barH = (v: number): number => (v / top.value) * plotH
const baseY = PAD.top + plotH

/** A bar with rounded top corners (radius up to 4px) standing on the baseline. */
function bar(i: number, v: number): string {
  const h = barH(v)
  if (h <= 0) return ''
  const x0 = barX(i)
  const w = barW.value
  const r = Math.min(4, w / 2, h)
  const y0 = baseY - h
  return `M${x0},${baseY}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + w - r}Q${x0 + w},${y0} ${x0 + w},${y0 + r}V${baseY}Z`
}

const labelEvery = computed(() => Math.max(1, Math.ceil(props.items.length / 7)))
</script>

<template>
  <figure ref="box" class="bars">
    <figcaption>
      <span>{{ title }}</span>
      <span class="total">{{ total }}</span>
    </figcaption>
    <svg :width="width" :height="HEIGHT" role="img" :aria-label="`${title}: ${total}`">
      <line class="grid" :x1="PAD.left" :x2="PAD.left + plotW" :y1="PAD.top" :y2="PAD.top" />
      <text class="axis" :x="PAD.left - 6" :y="PAD.top + 4" text-anchor="end">{{ top }}</text>
      <text class="axis" :x="PAD.left - 6" :y="baseY + 4" text-anchor="end">0</text>
      <path
        v-for="(item, i) in items"
        :key="item.key"
        class="bar"
        :class="{ dim: hover !== null && hover !== i }"
        :d="bar(i, item.value)"
      />
      <line class="base" :x1="PAD.left" :x2="PAD.left + plotW" :y1="baseY" :y2="baseY" />
      <template v-for="(item, i) in items" :key="`t${item.key}`">
        <text
          v-if="(items.length - 1 - i) % labelEvery === 0"
          class="axis"
          :x="barX(i) + barW / 2"
          :y="HEIGHT - 6"
          text-anchor="middle"
        >
          {{ item.label }}
        </text>
      </template>
      <!-- Hit areas: the whole column, wider than the bar. -->
      <rect
        v-for="(item, i) in items"
        :key="`h${item.key}`"
        class="hit"
        :x="PAD.left + i * slot"
        :y="PAD.top"
        :width="slot"
        :height="plotH"
        @pointerenter="hover = i"
        @pointerleave="hover = null"
      >
        <title>{{ item.tip }}: {{ item.value }}</title>
      </rect>
    </svg>
    <div
      v-if="hover !== null && items[hover]"
      class="tip"
      :style="{ left: `${Math.min(barX(hover), width - 150)}px`, top: '28px' }"
    >
      {{ items[hover].tip }}: <b>{{ items[hover].value }}</b>
    </div>
  </figure>
</template>

<style scoped>
.bars {
  position: relative;
  margin: 0;
  min-width: 0;
}
figcaption {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.total {
  font-weight: 400;
  color: var(--text-secondary);
}
svg {
  display: block;
}
.bar {
  fill: var(--series-1);
}
.bar.dim {
  opacity: 0.45;
}
.grid {
  stroke: var(--grid);
}
.base {
  stroke: var(--axis);
}
.axis {
  fill: var(--text-muted);
  font-size: 11px;
}
.hit {
  fill: transparent;
}
.tip {
  position: absolute;
  pointer-events: none;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgb(0 0 0 / 12%);
  white-space: nowrap;
}
</style>
