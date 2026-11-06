<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCare } from '../composables/useCare'
import { CARE } from '../../shared/careConfig'
import { moodLabel, percent } from '../../shared/careText'
import { sanitizeName } from '../../shared/petRecord'
import type { Strings } from '../../shared/strings'

const props = defineProps<{
  text: Strings
  /** FR-47: the hungry reminder switch lives with the cat. */
  hungerReminder: boolean
  setHungerReminder: (on: boolean) => void
}>()
const { pet, rename, adoptNew, openAdopt } = useCare()
const text = computed(() => props.text.settings)

const draft = ref('')
const invalid = ref(false)
// Keep the field in sync with the stored name unless the user is editing it.
watch(
  () => pet.value?.name,
  (name) => {
    if (name !== undefined) draft.value = name
  },
  { immediate: true }
)

const changed = computed(() => pet.value && draft.value.trim() !== pet.value.name)
const adoptedOn = computed(() =>
  pet.value
    ? new Date(pet.value.adoptedAt).toLocaleDateString(props.text.locale, { dateStyle: 'long' })
    : ''
)

async function saveName(): Promise<void> {
  invalid.value = sanitizeName(draft.value) === null || !(await rename(draft.value))
}
</script>

<template>
  <section class="pet">
    <h2>{{ text.petSection }}</h2>

    <template v-if="pet">
      <form class="name" @submit.prevent="saveName">
        <label for="pet-name">{{ text.name }}</label>
        <input id="pet-name" v-model="draft" type="text" autocomplete="off" />
        <button type="submit" :disabled="!changed">{{ text.rename }}</button>
      </form>
      <p v-if="invalid" class="error">{{ text.nameInvalid(CARE.nameMaxLength) }}</p>

      <div class="bar">
        <span>{{ text.fed }}</span>
        <meter min="0" max="100" low="30" optimum="100" :value="pet.needs.hunger" />
        <output>{{ percent(pet.needs.hunger) }}%</output>
      </div>
      <div class="bar">
        <span>{{ text.happy }}</span>
        <meter min="0" max="100" low="30" optimum="100" :value="pet.needs.happiness" />
        <output>{{ percent(pet.needs.happiness) }}%</output>
      </div>
      <p class="meta">
        {{ text.mood }}: <strong>{{ moodLabel(pet.mood, props.text) }}</strong> ·
        {{ text.adoptedOn(adoptedOn) }}
      </p>
      <label class="reminder">
        <input
          type="checkbox"
          :checked="hungerReminder"
          @change="setHungerReminder(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ text.hungerReminder }}</span>
      </label>
      <button class="danger" type="button" @click="adoptNew">{{ text.adoptNew }}</button>
    </template>

    <template v-else-if="pet === null">
      <p class="meta">{{ text.noPet }}</p>
      <button class="primary" type="button" @click="openAdopt">{{ text.adopt }}</button>
    </template>
  </section>
</template>

<style scoped>
.pet {
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2ddd6;
}

h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.name {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.name input {
  padding: 5px 8px;
  font: inherit;
  border: 1px solid #c9c2b8;
  border-radius: 6px;
  user-select: text;
}

.bar {
  display: grid;
  grid-template-columns: 56px 1fr 44px;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

meter {
  width: 100%;
  height: 12px;
}

output {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.meta {
  margin: 10px 0 12px;
  color: #555;
}

.reminder {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
}

.reminder input {
  width: 16px;
  height: 16px;
  accent-color: #e8893a;
}

.error {
  margin: -6px 0 10px 66px;
  font-size: 12px;
  color: #b3261e;
}

button {
  padding: 5px 12px;
  font: inherit;
  border-radius: 6px;
  border: 1px solid #c9c2b8;
  background: #fff;
}

button.primary {
  color: #fff;
  background: #e8893a;
  border-color: #e8893a;
}

button.danger {
  color: #b3261e;
  border-color: #e3b3ae;
}
</style>
