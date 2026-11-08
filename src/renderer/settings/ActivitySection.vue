<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { checkServerUrl } from '../../shared/activity'
import { activityStatus, activityTestText } from '../../shared/activityText'
import type { ActivityView } from '../../shared/ipc'
import type { Settings } from '../../shared/settings'
import type { Strings } from '../../shared/strings'

/** requirement-v6.md FR-87, FR-88: the Activity log group in Settings. */
const props = defineProps<{
  text: Strings
  settings: Settings
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>
}>()

const RETRY_REFRESH_MS = 30_000

const api = window.settingsApi
const t = computed(() => props.text.activity)
const view = ref<ActivityView | null>(null)
const urlDraft = ref(props.settings.activityServerUrl)
const keyDraft = ref('')
const keyError = ref(false)
const testing = ref(false)
const testResult = ref<string | null>(null)
const now = ref(Date.now())
let unsubscribe: (() => void) | null = null
let clock: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  unsubscribe = api.onActivityChanged((next) => {
    view.value = next
  })
  view.value = await api.getActivity()
})
onBeforeUnmount(() => {
  unsubscribe?.()
  if (clock) clearInterval(clock)
})

// "Trying again in N min" counts down only while a retry waits.
watch(
  () => view.value?.state.kind,
  (kind) => {
    if (kind === 'retrying' && !clock) {
      now.value = Date.now()
      clock = setInterval(() => (now.value = Date.now()), RETRY_REFRESH_MS)
    } else if (kind !== 'retrying' && clock) {
      clearInterval(clock)
      clock = null
    }
  }
)
watch(
  () => props.settings.activityServerUrl,
  (url) => (urlDraft.value = url)
)

const status = computed(() =>
  view.value ? activityStatus(view.value.state, props.text, now.value) : []
)
const urlProblem = computed(() => {
  const checked = checkServerUrl(urlDraft.value)
  return !checked.ok && checked.reason !== 'empty' ? t.value.badUrl : null
})

function saveUrl(): void {
  testResult.value = null
  if (urlDraft.value.trim() !== props.settings.activityServerUrl)
    void props.set('activityServerUrl', urlDraft.value.trim())
}

async function saveKey(): Promise<void> {
  if (keyDraft.value.trim() === '') return
  testResult.value = null
  keyError.value = !(await api.setActivityKey(keyDraft.value))
  if (!keyError.value) keyDraft.value = ''
}

async function removeKey(): Promise<void> {
  testResult.value = null
  await api.setActivityKey('')
}

async function test(): Promise<void> {
  saveUrl()
  testing.value = true
  testResult.value = null
  try {
    testResult.value = activityTestText(await api.testActivity(), props.text)
  } finally {
    testing.value = false
  }
}

function checkedFrom(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}
</script>

<template>
  <section class="activity">
    <h2>{{ t.section }}</h2>

    <label class="check">
      <input
        type="checkbox"
        :checked="settings.activityLog"
        @change="set('activityLog', checkedFrom($event))"
      />
      <span>{{ t.enabled }}</span>
    </label>
    <p class="note">{{ t.note }}</p>

    <label class="field">
      <span>{{ t.url }}</span>
      <input
        v-model="urlDraft"
        type="url"
        spellcheck="false"
        :placeholder="t.urlPlaceholder"
        @change="saveUrl"
        @keydown.enter="saveUrl"
      />
    </label>
    <p v-if="urlProblem" class="error">{{ urlProblem }}</p>

    <form class="field" @submit.prevent="saveKey">
      <span>{{ t.key }}</span>
      <input
        v-model="keyDraft"
        type="password"
        autocomplete="off"
        spellcheck="false"
        :placeholder="view?.hasKey ? `•••••• ${t.keySaved}` : t.keyPlaceholder"
      />
      <button v-if="keyDraft.trim() !== ''" type="submit">{{ t.saveKey }}</button>
      <button v-else-if="view?.hasKey" type="button" class="danger" @click="removeKey">
        {{ t.removeKey }}
      </button>
    </form>
    <p v-if="keyError" class="error">{{ t.keyNotSaved }}</p>

    <div class="actions">
      <button type="button" :disabled="testing" @click="test">
        {{ testing ? t.testing : t.test }}
      </button>
      <span v-if="testResult" class="result">{{ testResult }}</span>
    </div>

    <div class="statusRow">
      <div>
        <p v-for="line in status" :key="line" class="status">{{ line }}</p>
      </div>
      <button
        v-if="view && view.state.waiting > 0"
        type="button"
        class="danger"
        @click="api.clearActivity()"
      >
        {{ t.clear }}
      </button>
    </div>
  </section>
</template>

<style scoped>
h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.check {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: #e8893a;
}

.note {
  margin: 0 0 10px 26px;
  font-size: 12px;
  color: #666;
  line-height: 1.35;
}

.field {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
}

.field input {
  grid-column: 2;
  min-width: 0;
  padding: 4px 8px;
  font: inherit;
  border: 1px solid #c9c2b8;
  border-radius: 6px;
  user-select: text;
}

.field input:only-of-type:last-child {
  grid-column: 2 / 4;
}

.error {
  margin: -4px 0 8px 104px;
  font-size: 12px;
  color: #b3261e;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 6px;
}

.result {
  font-size: 13px;
  color: #444;
}

.statusRow {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 10px;
}

.status {
  margin: 0 0 4px;
  font-size: 13px;
  color: #555;
  line-height: 1.35;
}

button {
  padding: 4px 12px;
  font: inherit;
  border-radius: 6px;
  border: 1px solid #c9c2b8;
  background: #fff;
}

button.danger {
  color: #b3261e;
  border-color: #e3b3ae;
}
</style>
