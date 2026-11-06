<script setup lang="ts">
import { ref } from 'vue'
import { usePetScene } from './composables/usePetScene'
import { useClickThrough } from './composables/useClickThrough'
import { usePetBehavior } from './composables/usePetBehavior'
import { usePetPointer } from './composables/usePetPointer'
import { usePetStroke } from './composables/usePetStroke'

const canvas = ref<HTMLCanvasElement | null>(null)
const scene = usePetScene(canvas)
const clickThrough = useClickThrough(scene.hitTest)
const behavior = usePetBehavior(scene)

usePetPointer(canvas, clickThrough, {
  hitTest: scene.hitTest,
  onClick: () => behavior.click(),
  onDragStart: () => behavior.dispatch('dragStart'),
  onDragEnd: () => behavior.dispatch('dragEnd'),
  onContextMenu: () => window.petApi.showContextMenu()
})

// FR-18: stroking the cat with the mouse pets it.
usePetStroke(scene.hitTest, () => behavior.stroke())

// The pet animates and the window walks, so the cursor can end up over empty space
// without moving. Re-test every frame so transparent areas never block the mouse.
scene.onFrame(clickThrough.recheck)

const overPet = clickThrough.overPet
</script>

<template>
  <canvas ref="canvas" class="pet-canvas" :class="{ 'is-over-pet': overPet }" />
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
