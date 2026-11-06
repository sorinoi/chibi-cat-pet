<script setup lang="ts">
import PetSection from './PetSection.vue'
import FocusSection from './FocusSection.vue'
import { useSettings } from '../composables/useSettings'
import { SETTINGS_LIMITS } from '../../shared/settings'
import { computed } from 'vue'
import { LANGUAGES, LANGUAGE_NAMES, isLanguage, stringsFor } from '../../shared/strings'
import { useDocumentLanguage } from '../composables/useLanguage'

const { settings, appVersion, canStartWithWindows, set } = useSettings()
const language = computed(() => settings.value?.language ?? 'en')
const strings = computed(() => stringsFor(language.value))
const text = computed(() => strings.value.settings)
useDocumentLanguage(
  () => language.value,
  () => text.value.title
)
const percent = (value: number): string => `${Math.round(value * 100)}%`

function numberFrom(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}
function languageFrom(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isLanguage(value)) void set('language', value)
}
function checkedFrom(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}
</script>

<template>
  <main v-if="settings" class="settings">
    <h1>{{ text.title }}</h1>

    <div class="columns">
      <div class="column">
        <PetSection :text="strings" />

        <h2 class="section">{{ text.generalSection }}</h2>

        <label class="row">
          <span class="label">{{ text.language }}</span>
          <select class="language" :value="settings.language" @change="languageFrom">
            <option v-for="code in LANGUAGES" :key="code" :value="code">
              {{ LANGUAGE_NAMES[code] }}
            </option>
          </select>
        </label>

        <label class="row">
          <span class="label">{{ text.petSize }}</span>
          <input
            type="range"
            :min="SETTINGS_LIMITS.petSize.min"
            :max="SETTINGS_LIMITS.petSize.max"
            :step="SETTINGS_LIMITS.petSize.step"
            :value="settings.petSize"
            @change="set('petSize', numberFrom($event))"
          />
          <output>{{ percent(settings.petSize) }}</output>
        </label>

        <label class="row">
          <span class="label">{{ text.opacity }}</span>
          <input
            type="range"
            :min="SETTINGS_LIMITS.opacity.min"
            :max="SETTINGS_LIMITS.opacity.max"
            :step="SETTINGS_LIMITS.opacity.step"
            :value="settings.opacity"
            @input="set('opacity', numberFrom($event))"
          />
          <output>{{ percent(settings.opacity) }}</output>
        </label>

        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.alwaysOnTop"
            @change="set('alwaysOnTop', checkedFrom($event))"
          />
          <span class="label">{{ text.alwaysOnTop }}</span>
        </label>

        <label class="row check">
          <input
            type="checkbox"
            :checked="settings.startWithWindows"
            @change="set('startWithWindows', checkedFrom($event))"
          />
          <span class="label">{{ text.startWithWindows }}</span>
        </label>
        <p v-if="!canStartWithWindows" class="note">{{ text.startWithWindowsDevNote }}</p>

        <label class="row">
          <span class="label">{{ text.sleepAfter }}</span>
          <input
            class="minutes"
            type="number"
            :min="SETTINGS_LIMITS.sleepAfterMinutes.min"
            :max="SETTINGS_LIMITS.sleepAfterMinutes.max"
            :step="SETTINGS_LIMITS.sleepAfterMinutes.step"
            :value="settings.sleepAfterMinutes"
            @change="set('sleepAfterMinutes', numberFrom($event))"
          />
        </label>
      </div>
      <div class="column">
        <FocusSection :text="strings" :settings="settings" :set="set" />
      </div>
    </div>

    <footer>{{ text.version(appVersion) }}</footer>
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
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.settings {
  padding: 20px 24px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 18px;
}

.section {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 150px 48px;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.row.check {
  grid-template-columns: auto 1fr;
}

.label {
  line-height: 1.3;
}

output {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

input[type='range'] {
  width: 100%;
  accent-color: #e8893a;
}

input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #e8893a;
}

.language {
  grid-column: 2 / 4;
  padding: 3px 6px;
  font: inherit;
}

.minutes {
  width: 64px;
  padding: 3px 6px;
  font: inherit;
}

.note {
  margin: -10px 0 16px 26px;
  font-size: 12px;
  color: #8a6d3b;
}

footer {
  margin-top: 24px;
  font-size: 12px;
  color: #888;
}
</style>
