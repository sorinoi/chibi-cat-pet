<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePetScene } from './composables/usePetScene'
import { useClickThrough } from './composables/useClickThrough'
import { usePetBehavior } from './composables/usePetBehavior'
import { usePetPointer } from './composables/usePetPointer'
import { usePetStroke } from './composables/usePetStroke'
import { usePetRest } from './composables/usePetRest'
import { careSummary } from '../shared/careText'
import { useLanguage } from './composables/useLanguage'
import { useFocusView } from './composables/useFocusView'
import { focusStatus } from '../shared/focusText'

const canvas = ref<HTMLCanvasElement | null>(null)
const scene = usePetScene(canvas)
const clickThrough = useClickThrough(scene.hitTest)
const behavior = usePetBehavior(scene, { pointerOnPet: () => clickThrough.overPet.value })
const { text } = useLanguage(window.petApi)
const focus = useFocusView(window.petApi.getFocus, window.petApi.onFocusState)

usePetPointer(canvas, clickThrough, {
  hitTest: scene.hitTest,
  onClick: () => behavior.click(),
  onDragStart: () => behavior.dispatch('dragStart'),
  onDragEnd: () => behavior.dispatch('dragEnd'),
  onContextMenu: () => {
    behavior.closeActions()
    window.petApi.showContextMenu()
  }
})

// FR-18: stroking the cat with the mouse pets it.
usePetStroke(scene.hitTest, () => behavior.stroke())

// requirement-v9.md FR-120, FR-121: resting the pointer on the cat opens the quick buttons;
// main hides them a moment after the pointer is on neither the cat nor a button.
usePetRest(scene.hitTest, behavior.canOpenActions, behavior.openActions)
watch(clickThrough.overPet, (over) => behavior.pointerOnPet(over))

// The pet animates and the window walks, so the cursor can end up over empty space
// without moving. Re-test every frame so transparent areas never block the mouse.
scene.onFrame(clickThrough.recheck)

const overPet = clickThrough.overPet

// FR-27 + FR-36: hovering over the cat shows its status and the focus timer (native tooltip).
const tooltip = computed(() => {
  if (!overPet.value || !behavior.care.value) return ''
  const lines = [careSummary(behavior.care.value, text.value)]
  if (focus.value) lines.push(focusStatus(focus.value, text.value))
  return lines.join('\n')
})
</script>

<template>
  <canvas ref="canvas" class="pet-canvas" :class="{ 'is-over-pet': overPet }" :title="tooltip" />
</template>

<style scoped>
.pet-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.is-over-pet {
  cursor: grab;
}
</style>
