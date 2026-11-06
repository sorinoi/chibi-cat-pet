<script setup lang="ts">
import { computed } from 'vue'
import { useFocusView } from '../composables/useFocusView'
import { SETTINGS_LIMITS, type Settings } from '../../shared/settings'
import type { Strings } from '../../shared/strings'

type MinuteKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery'
type ToggleKey = 'autoStartBreaks' | 'autoStartFocus' | 'focusNotifications'

const props = defineProps<{
  text: Strings
  settings: Settings
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>
}>()

const t = computed(() => props.text.focus.settings)
const focus = useFocusView(window.settingsApi.getFocus, window.settingsApi.onFocusChanged)

/** FR-39: number fields in a compact grid, then the switches. */
const numbers = computed<Array<{ key: MinuteKey; label: string }>>(() => [
  { key: 'focusMinutes', label: t.value.focusMinutes },
  { key: 'shortBreakMinutes', label: t.value.shortBreakMinutes },
  { key: 'longBreakMinutes', label: t.value.longBreakMinutes },
  { key: 'longBreakEvery', label: t.value.longBreakEvery }
])
const toggles = computed<Array<{ key: ToggleKey; label: string }>>(() => [
  { key: 'autoStartBreaks', label: t.value.autoStartBreaks },
  { key: 'autoStartFocus', label: t.value.autoStartFocus },
  { key: 'focusNotifications', label: t.value.notifications }
])

function setNumber(key: MinuteKey, event: Event): void {
  void props.set(key, Number((event.target as HTMLInputElement).value))
}
function setToggle(key: ToggleKey, event: Event): void {
  void props.set(key, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <section class="focus">
    <h2>{{ t.section }}</h2>

    <div class="numbers">
      <label v-for="item in numbers" :key="item.key" class="number">
        <span>{{ item.label }}</span>
        <input
          type="number"
          :min="SETTINGS_LIMITS[item.key].min"
          :max="SETTINGS_LIMITS[item.key].max"
          :step="SETTINGS_LIMITS[item.key].step"
          :value="settings[item.key]"
          @change="setNumber(item.key, $event)"
        />
      </label>
    </div>

    <label v-for="item in toggles" :key="item.key" class="check">
      <input type="checkbox" :checked="settings[item.key]" @change="setToggle(item.key, $event)" />
      <span>{{ item.label }}</span>
    </label>

    <p v-if="focus" class="today">{{ t.completedToday(focus.completedToday) }}</p>
  </section>
</template>

<style scoped>
.focus {
  margin-bottom: 22px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e2ddd6;
}

h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  margin-bottom: 12px;
}

.number {
  display: grid;
  grid-template-columns: 1fr 58px;
  align-items: center;
  gap: 8px;
  line-height: 1.25;
}

.number input {
  width: 58px;
  padding: 3px 6px;
  font: inherit;
  box-sizing: border-box;
}

.check {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: #e8893a;
}

.today {
  margin: 4px 0 0;
  color: #555;
}
</style>
