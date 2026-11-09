<script setup lang="ts">
import { computed, ref } from 'vue'
import LookPreview from '../components/LookPreview.vue'
import { ACTIVE_MODEL } from '../../shared/activeModel'
import { CARE } from '../../shared/careConfig'
import { nameLength, sanitizeName } from '../../shared/petRecord'
import { useDocumentLanguage, useLanguage } from '../composables/useLanguage'

const { language, text: strings } = useLanguage(window.adoptApi)
const text = computed(() => strings.value.adopt)
useDocumentLanguage(
  () => language.value,
  () => text.value.title
)
const name = ref('')
const busy = ref(false)
const failed = ref(false)
/** requirement-v7.md FR-106: the looks, default first, and the one picked. */
const looks = Object.keys(ACTIVE_MODEL.looks)
const look = ref(ACTIVE_MODEL.defaultLook)
const LOOK_PREVIEW_SIZE = 84

const length = computed(() => nameLength(name.value.trim()))
const valid = computed(() => sanitizeName(name.value) !== null)

async function adopt(): Promise<void> {
  if (!valid.value || busy.value) return
  busy.value = true
  failed.value = false
  const ok = await window.adoptApi.adopt(name.value, look.value)
  // On success main closes this window; on failure let the user try again.
  if (!ok) {
    failed.value = true
    busy.value = false
  }
}
</script>

<template>
  <main class="adopt">
    <h1>{{ text.heading }}</h1>
    <p class="intro">{{ text.intro }}</p>
    <form @submit.prevent="adopt">
      <div class="looks" role="radiogroup" :aria-label="text.lookLabel">
        <label v-for="id in looks" :key="id" class="look" :class="{ on: id === look }">
          <input v-model="look" type="radio" name="look" :value="id" />
          <LookPreview :look="id" :size="LOOK_PREVIEW_SIZE" />
          <span>{{ strings.looks[id] ?? id }}</span>
        </label>
      </div>
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

.looks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 0 0 16px;
}

.look {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 4px 6px 6px;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
}

.look.on {
  border-color: #e8893a;
  background: #fff;
}

.look:has(input:focus-visible) {
  outline: 2px solid #1d6fd6;
  outline-offset: 2px;
}

.look input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.look span {
  font-size: 12px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 8px 0 6px;
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
