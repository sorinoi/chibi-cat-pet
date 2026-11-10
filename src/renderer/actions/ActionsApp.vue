<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ActionId, ActionsLayout } from '../../shared/ipc'
import { ACTION_MOTION } from '../../shared/quickActions'
import { ACTIONS_VIEW } from '../config'

/**
 * requirement-v9.md: the quick buttons around the cat. Main places this window and sends the
 * layout; the page draws the buttons, lets clicks through everywhere else (FR-126), shows the
 * label of the button under the pointer (FR-127), animates them (FR-133) and tells main
 * whether the pointer is on a button (FR-121) and which one was clicked (FR-128..131).
 */
const api = window.actionsApi
const layout = ref<ActionsLayout | null>(null)
const hovered = ref<ActionId | null>(null)
const labelEl = ref<HTMLElement | null>(null)
const labelWidth = ref(0)
/**
 * FR-133: start = folded into the cat (no transition), open = grown out to the arc (staggered)
 * and bobbing, closing = shrinking back together. Nothing animates outside open and closing.
 */
const phase = ref<'start' | 'open' | 'closing'>('start')
let overButton = false
let openFrame = 0
/** FR-133, NFR-50: the bob, on a slow timer that runs only while the buttons show. */
let bobTimer: ReturnType<typeof setInterval> | null = null
const bobEls: Array<HTMLElement | null> = []
const bobShown: number[] = []

function setOverButton(over: boolean): void {
  if (over === overButton) return
  overButton = over
  api.setIgnoreMouseEvents(!over)
  api.setHover(over)
}

const onMove = (e: MouseEvent): void => {
  if (phase.value !== 'open') return
  const target = e.target instanceof Element ? e.target : null
  setOverButton(target?.closest('button') != null)
}
const onLeave = (): void => {
  hovered.value = null
  setOverButton(false)
}

function run(id: ActionId): void {
  if (phase.value !== 'open') return
  hovered.value = null
  setOverButton(false)
  api.run(id)
}

/** Each button's slot: its place on the arc, or folded into the cat before and after. */
function slotStyle(
  button: ActionsLayout['buttons'][number],
  index: number
): Record<string, string> {
  const l = layout.value
  if (!l) return {}
  const size = l.size
  const base = {
    left: `${button.x - size / 2}px`,
    top: `${button.y - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`
  }
  if (phase.value === 'open') {
    return {
      ...base,
      transform: 'none',
      opacity: '1',
      transition: `transform ${ACTION_MOTION.appearMs}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * ACTION_MOTION.staggerMs}ms, opacity ${ACTION_MOTION.appearMs}ms ease-out ${index * ACTION_MOTION.staggerMs}ms`
    }
  }
  const folded = `translate(${l.origin.x - button.x}px, ${l.origin.y - button.y}px) scale(${ACTION_MOTION.startScale})`
  return {
    ...base,
    transform: folded,
    opacity: '0',
    transition:
      phase.value === 'closing'
        ? `transform ${ACTION_MOTION.hideMs}ms ease-in, opacity ${ACTION_MOTION.hideMs}ms ease-in`
        : 'none'
  }
}

/** FR-133: every button bobs at its own phase; only a changed offset is written (repaint). */
function bobTick(): void {
  const { bobDip, bobPeriodMs, bobStepDip } = ACTION_MOTION
  const count = bobEls.length
  const t = performance.now() / bobPeriodMs
  for (let i = 0; i < count; i++) {
    const el = bobEls[i]
    if (!el) continue
    const wave = (1 - Math.cos(2 * Math.PI * (t + i / count))) / 2
    const offset = -Math.round((bobDip * wave) / bobStepDip) * bobStepDip
    if (bobShown[i] === offset) continue
    bobShown[i] = offset
    el.style.transform = offset === 0 ? '' : `translateY(${offset}px)`
  }
}

function startBob(): void {
  stopBob()
  bobTimer = setInterval(bobTick, 1000 / ACTION_MOTION.bobFps)
}

function stopBob(): void {
  if (bobTimer) clearInterval(bobTimer)
  bobTimer = null
}

const setBobEl = (el: unknown, index: number): void => {
  bobEls[index] = el instanceof HTMLElement ? el : null
}

/** Motion amounts for the CSS (FR-133). */
const motionVars = { '--hover-scale': String(ACTION_MOTION.hoverScale) }

const buttonStyle = computed(() => ({
  fontSize: `${Math.round((layout.value?.size ?? 0) * ACTIONS_VIEW.iconScale)}px`
}))

const hoveredButton = computed(
  () => layout.value?.buttons.find((b) => b.id === hovered.value) ?? null
)

// The label is measured once it is drawn, so it can be kept inside the window and the screen.
watch(hoveredButton, async () => {
  await nextTick()
  labelWidth.value = labelEl.value?.offsetWidth ?? 0
})

/** FR-127: on the outer side of the button, centred on it, kept on screen. */
const labelStyle = computed((): Record<string, string> => {
  const l = layout.value
  const b = hoveredButton.value
  if (!l || !b) return {}
  const inset = ACTIONS_VIEW.labelInset
  const minX = Math.max(inset, l.area.x + inset)
  const maxX = Math.min(window.innerWidth, l.area.x + l.area.width) - inset - labelWidth.value
  const left = Math.min(Math.max(b.x - labelWidth.value / 2, minX), Math.max(minX, maxX))
  const reach = l.size / 2 + ACTIONS_VIEW.labelGap
  return l.side === 'above'
    ? { left: `${left}px`, bottom: `${window.innerHeight - (b.y - reach)}px` }
    : { left: `${left}px`, top: `${b.y + reach}px` }
})

/** Fold the buttons into the cat at once, then let them grow out on the next frames. */
function playOpen(): void {
  cancelAnimationFrame(openFrame)
  phase.value = 'start'
  void nextTick(() => {
    openFrame = requestAnimationFrame(() => {
      openFrame = requestAnimationFrame(() => {
        phase.value = 'open'
        startBob()
      })
    })
  })
}

const unsubscribers: Array<() => void> = []
onMounted(() => {
  // Re-arm forwarding once the page exists (main sets it before the page loads).
  api.setIgnoreMouseEvents(true)
  unsubscribers.push(
    api.onLayout((next) => {
      const redraw = phase.value === 'open' && layout.value !== null
      layout.value = next
      bobEls.length = next.buttons.length
      bobShown.length = 0
      // A redraw while open (the timer or language changed, FR-129) keeps everything as is.
      if (redraw) {
        if (!next.buttons.some((b) => b.id === hovered.value)) hovered.value = null
        return
      }
      // A new showing starts with the mouse passing through until it is on a button.
      hovered.value = null
      overButton = true
      setOverButton(false)
      playOpen()
    }),
    api.onHide(() => {
      cancelAnimationFrame(openFrame)
      stopBob()
      hovered.value = null
      overButton = false
      phase.value = 'closing'
    })
  )
  window.addEventListener('mousemove', onMove)
  document.documentElement.addEventListener('mouseleave', onLeave)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(openFrame)
  stopBob()
  unsubscribers.forEach((fn) => fn())
  window.removeEventListener('mousemove', onMove)
  document.documentElement.removeEventListener('mouseleave', onLeave)
})
</script>

<template>
  <div v-if="layout" class="actions" :style="motionVars">
    <div
      v-for="(button, index) in layout.buttons"
      :key="button.id"
      class="slot"
      :style="slotStyle(button, index)"
    >
      <div :ref="(el) => setBobEl(el, index)" class="bob">
        <button
          type="button"
          class="action"
          :aria-label="button.label"
          :style="buttonStyle"
          @mouseenter="hovered = button.id"
          @mouseleave="hovered = null"
          @click="run(button.id)"
        >
          {{ ACTIONS_VIEW.icons[button.variant] }}
        </button>
      </div>
    </div>
    <span
      v-if="hoveredButton && phase === 'open'"
      ref="labelEl"
      class="label"
      :style="{ ...labelStyle, maxWidth: `${ACTIONS_VIEW.labelMaxWidth}px` }"
    >
      {{ hoveredButton.label }}
    </span>
  </div>
</template>

<style scoped>
.actions {
  position: relative;
  width: 100%;
  height: 100%;
}

.slot {
  position: absolute;
  will-change: transform, opacity;
}

.bob {
  width: 100%;
  height: 100%;
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1.5px solid rgba(90, 70, 50, 0.22);
  border-radius: 50%;
  background: rgba(255, 252, 247, 0.96);
  box-shadow: 0 2px 6px rgba(60, 40, 20, 0.18);
  font-family: 'Segoe UI Emoji', 'Segoe UI', sans-serif;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 120ms ease-out,
    background 120ms,
    border-color 120ms;
}

/* FR-133: the hovered button grows a little (ACTION_MOTION.hoverScale). */
.action:hover {
  transform: scale(var(--hover-scale));
  background: #fff;
  border-color: rgba(90, 70, 50, 0.4);
}

.label {
  position: absolute;
  padding: 3px 9px;
  border-radius: 10px;
  background: rgba(55, 42, 32, 0.88);
  color: #fff;
  font:
    12px/1.35 'Segoe UI',
    'Leelawadee UI',
    sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
</style>
