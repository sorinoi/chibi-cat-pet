<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { spriteSheetUrl } from '../models/registry'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import { CARE } from '../../shared/careConfig'
import { nameLength, sanitizeName } from '../../shared/petRecord'
import { STRINGS } from '../../shared/strings'

const text = STRINGS.adopt
const name = ref('')
const busy = ref(false)
const failed = ref(false)
const preview = ref<HTMLCanvasElement | null>(null)

const length = computed(() => nameLength(name.value.trim()))
const valid = computed(() => sanitizeName(name.value) !== null)

async function adopt(): Promise<void> {
  if (!valid.value || busy.value) return
  busy.value = true
  failed.value = false
  const ok = await window.adoptApi.adopt(name.value)
  // On success main closes this window; on failure let the user try again.
  if (!ok) {
    failed.value = true
    busy.value = false
  }
}

/** Draws the cat's first idle frame as a preview of who is being adopted. */
onMounted(async () => {
  const el = preview.value
  const clip = ACTIVE_MODEL.clips.idle
  const sheet = ACTIVE_MODEL.sheets[clip.sheet]
  if (!el || !sheet) return
  const img = new Image()
  img.src = spriteSheetUrl(sheet.file)
  await img.decode()
  const ctx = el.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio
  el.width = el.clientWidth * dpr
  el.height = el.clientHeight * dpr
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    0,
    clip.row * sheet.cellHeight,
    sheet.cellWidth,
    sheet.cellHeight,
    0,
    0,
    el.width,
    el.height
  )
})
</script>

<template>
  <main class="adopt">
    <canvas ref="preview" class="preview" aria-hidden="true" />
    <h1>{{ text.heading }}</h1>
    <p class="intro">{{ text.intro }}</p>
    <form @submit.prevent="adopt">
      <label for="name">{{ text.nameLabel }}</label>
      <div class="row">
        <input
          id="name"
          v-model="name"
          type="text"
          autocomplete="off"
          :placeholder="text.placeholder"
          autofocus
        />
        <span class="count" :class="{ over: length > CARE.nameMaxLength }">
          {{ text.count(length, CARE.nameMaxLength) }}
        </span>
      </div>
      <p v-if="failed" class="error">{{ text.failed }}</p>
      <button type="submit" :disabled="!valid || busy">{{ text.button }}</button>
    </form>
  </main>
</template>

<style>
html,
body {
  margin: 0;
  font-family: 'Segoe UI', 'Leelawadee UI', system-ui, sans-serif;
  font-size: 14px;
  color: #222;
  background: #f6f4f1;
  user-select: none;
}
</style>

<style scoped>
.adopt {
  padding: 16px 28px 24px;
  text-align: center;
}

.preview {
  width: 150px;
  height: 150px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 4px 0 6px;
}

.intro {
  margin: 0 0 18px;
  color: #555;
  line-height: 1.4;
}

form {
  text-align: left;
}

label {
  display: block;
  margin-bottom: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

input {
  flex: 1;
  padding: 7px 9px;
  font: inherit;
  border: 1px solid #c9c2b8;
  border-radius: 6px;
  user-select: text;
}

.count {
  font-size: 12px;
  color: #888;
  font-variant-numeric: tabular-nums;
}

.count.over {
  color: #b3261e;
}

.error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #b3261e;
}

button {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 9px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #e8893a;
  border: none;
  border-radius: 6px;
}

button:disabled {
  opacity: 0.5;
}
</style>
