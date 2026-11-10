<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ActionId, ActionsLayout } from '../../shared/ipc'
import { ACTIONS_VIEW } from '../config'

/**
 * requirement-v9.md: the quick buttons around the cat. Main places this window and sends the
 * layout; the page draws the buttons, lets clicks through everywhere else (FR-126) and tells
 * main whether the pointer is on a button (FR-121) and which one was clicked.
 */
const api = window.actionsApi
const layout = ref<ActionsLayout | null>(null)
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
const onLeave = (): void => setOverButton(false)

function run(id: ActionId): void {
  setOverButton(false)
  api.run(id)
}

const style = (button: ActionsLayout['buttons'][number], size: number): Record<string, string> => ({
  left: `${button.x - size / 2}px`,
  top: `${button.y - size / 2}px`,
  width: `${size}px`,
  height: `${size}px`,
  fontSize: `${Math.round(size * ACTIONS_VIEW.iconScale)}px`
})

let unsubscribe: (() => void) | null = null
onMounted(() => {
  // Re-arm forwarding once the page exists (main sets it before the page loads).
  api.setIgnoreMouseEvents(true)
  unsubscribe = api.onLayout((next) => {
    // A new showing starts with the mouse passing through until it is on a button.
    overButton = true
    setOverButton(false)
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
      :style="style(button, layout.size)"
      @click="run(button.id)"
    >
      {{ ACTIONS_VIEW.icons[button.id] }}
    </button>
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
</style>
