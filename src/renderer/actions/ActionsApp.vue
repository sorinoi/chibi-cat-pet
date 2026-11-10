<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ActionId, ActionsLayout } from '../../shared/ipc'
import { ACTIONS_VIEW } from '../config'

/**
 * requirement-v9.md: the quick buttons around the cat. Main places this window and sends the
 * layout; the page draws the buttons, lets clicks through everywhere else (FR-126), shows the
 * label of the button under the pointer (FR-127) and tells main whether the pointer is on a
 * button (FR-121) and which one was clicked (FR-128..131).
 */
const api = window.actionsApi
const layout = ref<ActionsLayout | null>(null)
const hovered = ref<ActionId | null>(null)
const labelEl = ref<HTMLElement | null>(null)
const labelWidth = ref(0)
let overButton = false

function setOverButton(over: boolean): void {
  if (over === overButton) return
  overButton = over
  api.setIgnoreMouseEvents(!over)
  api.setHover(over)
}

const onMove = (e: MouseEvent): void => {
  const target = e.target instanceof Element ? e.target : null
  setOverButton(target?.closest('button') != null)
}
const onLeave = (): void => {
  hovered.value = null
  setOverButton(false)
}

function run(id: ActionId): void {
  hovered.value = null
  setOverButton(false)
  api.run(id)
}

const buttonStyle = (
  button: ActionsLayout['buttons'][number],
  size: number
): Record<string, string> => ({
  left: `${button.x - size / 2}px`,
  top: `${button.y - size / 2}px`,
  width: `${size}px`,
  height: `${size}px`,
  fontSize: `${Math.round(size * ACTIONS_VIEW.iconScale)}px`
})

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

let unsubscribe: (() => void) | null = null
onMounted(() => {
  // Re-arm forwarding once the page exists (main sets it before the page loads).
  api.setIgnoreMouseEvents(true)
  unsubscribe = api.onLayout((next) => {
    // A new showing starts with the mouse passing through until it is on a button. A redraw
    // while open (the timer changed, FR-129) keeps the button under the pointer.
    if (!layout.value || !next.buttons.some((b) => b.id === hovered.value)) {
      hovered.value = null
      overButton = true
      setOverButton(false)
    }
    layout.value = next
  })
  window.addEventListener('mousemove', onMove)
  document.documentElement.addEventListener('mouseleave', onLeave)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  window.removeEventListener('mousemove', onMove)
  document.documentElement.removeEventListener('mouseleave', onLeave)
})
</script>

<template>
  <div v-if="layout" class="actions">
    <button
      v-for="button in layout.buttons"
      :key="button.id"
      type="button"
      class="action"
      :aria-label="button.label"
      :style="buttonStyle(button, layout.size)"
      @mouseenter="hovered = button.id"
      @mouseleave="hovered = null"
      @click="run(button.id)"
    >
      {{ ACTIONS_VIEW.icons[button.variant] }}
    </button>
    <span
      v-if="hoveredButton"
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

.action {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1.5px solid rgba(90, 70, 50, 0.22);
  border-radius: 50%;
  background: rgba(255, 252, 247, 0.96);
  box-shadow: 0 2px 6px rgba(60, 40, 20, 0.18);
  font-family: 'Segoe UI Emoji', 'Segoe UI', sans-serif;
  line-height: 1;
  cursor: pointer;
}

.action:hover {
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
