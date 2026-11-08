<script setup lang="ts">
/** FR-97: every event, newest first, filtered by pet, type and dates, paged. */
import { computed, onMounted, ref, watch } from 'vue'
import { ACTIVITY_TYPES } from '../../../../src/shared/activity.ts'
import type { EventPage, Me, PetSummary } from '../../../src/dashTypes.ts'
import { api } from '../api.ts'
import { eventDetail, formatDateTime, formatNeed } from '../format.ts'
import type { Text } from '../i18n.ts'

const props = defineProps<{ t: Text; me: Me; reload: number }>()
const emit = defineEmits<{ error: [err: unknown] }>()

const pets = ref<PetSummary[]>([])
const filter = ref({ pet: '', type: '', from: '', to: '' })
const page = ref(1)
const data = ref<EventPage | null>(null)
const failed = ref(false)

async function load(): Promise<void> {
  failed.value = false
  try {
    const query: Record<string, string> = { page: String(page.value) }
    for (const [k, v] of Object.entries(filter.value)) if (v) query[k] = v
    data.value = await api.events(query)
  } catch (err) {
    failed.value = true
    emit('error', err)
  }
}

onMounted(async () => {
  try {
    pets.value = await api.pets()
  } catch (err) {
    emit('error', err)
  }
  await load()
})
watch(
  filter,
  () => {
    page.value = 1
    void load()
  },
  { deep: true }
)
watch(page, () => void load())
// The Refresh button: the pet list and this page again, keeping the filters.
watch(
  () => props.reload,
  async () => {
    try {
      pets.value = await api.pets()
    } catch (err) {
      emit('error', err)
    }
    await load()
  }
)

const pages = computed(() =>
  data.value ? Math.max(1, Math.ceil(data.value.total / data.value.size)) : 1
)
const e = computed(() => props.t.events)
</script>

<template>
  <section class="card">
    <h1>{{ e.title }}</h1>
    <div class="filters">
      <label>
        <span>{{ e.pet }}</span>
        <select v-model="filter.pet">
          <option value="">{{ e.all }}</option>
          <option v-for="p in pets" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label>
        <span>{{ e.type }}</span>
        <select v-model="filter.type">
          <option value="">{{ e.all }}</option>
          <option v-for="type in ACTIVITY_TYPES" :key="type" :value="type">
            {{ t.types[type] ?? type }}
          </option>
        </select>
      </label>
      <label>
        <span>{{ e.from }}</span>
        <input v-model="filter.from" type="date" />
      </label>
      <label>
        <span>{{ e.to }}</span>
        <input v-model="filter.to" type="date" />
      </label>
    </div>

    <p v-if="failed" class="error">{{ t.loadFailed }}</p>
    <template v-else-if="data">
      <p class="muted count">{{ e.count(data.total) }}</p>
      <p v-if="data.rows.length === 0" class="muted">{{ e.none }}</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ e.time }}</th>
              <th>{{ e.type }}</th>
              <th>{{ e.pet }}</th>
              <th class="num">{{ t.overview.fed }}</th>
              <th class="num">{{ t.overview.happy }}</th>
              <th>{{ e.details }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows" :key="row.id">
              <td class="time">{{ formatDateTime(row.at, t.locale, me.timeZone) }}</td>
              <td>{{ t.types[row.type] ?? row.type }}</td>
              <td>{{ row.petName }}</td>
              <td class="num">{{ formatNeed(row.hunger) }}</td>
              <td class="num">{{ formatNeed(row.happiness) }}</td>
              <td class="muted">{{ eventDetail(row, t) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="pages > 1" class="pager">
        <button type="button" :disabled="page <= 1" @click="page--">{{ e.prev }}</button>
        <span class="muted">{{ e.page(page, pages) }}</span>
        <button type="button" :disabled="page >= pages" @click="page++">{{ e.next }}</button>
      </div>
    </template>
    <p v-else class="muted">{{ t.loading }}</p>
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 12px;
  font-size: 18px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-bottom: 12px;
}
.filters label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.count {
  margin: 0 0 8px;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
td.num,
th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}
</style>
