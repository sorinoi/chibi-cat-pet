<script setup lang="ts">
/** FR-96: the current pet, its needs over time, care per day, focus per day and week, streak. */
import { computed, onMounted, ref, watch } from 'vue'
import { OVERVIEW_DAYS, type Me, type Overview, type PetSummary } from '../../../src/dashTypes.ts'
import { api, ApiError } from '../api.ts'
import BarChart from '../components/BarChart.vue'
import LineChart from '../components/LineChart.vue'
import { formatDate, formatDateTime, formatDay } from '../format.ts'
import type { Text } from '../i18n.ts'

const props = defineProps<{ t: Text; me: Me; reload: number }>()
const emit = defineEmits<{ error: [err: unknown] }>()

const pets = ref<PetSummary[]>([])
const petId = ref<string | null>(null)
const days = ref<number>(OVERVIEW_DAYS[0])
const data = ref<Overview | null>(null)
const state = ref<'loading' | 'ready' | 'noPet' | 'failed'>('loading')

async function load(): Promise<void> {
  try {
    if (pets.value.length === 0) pets.value = await api.pets()
    if (pets.value.length === 0) {
      state.value = 'noPet'
      return
    }
    data.value = await api.overview(petId.value, days.value)
    petId.value = data.value.pet.id
    state.value = 'ready'
  } catch (err) {
    state.value = err instanceof ApiError && err.status === 404 ? 'noPet' : 'failed'
    emit('error', err)
  }
}
onMounted(load)
// The Refresh button: fetch the pet list and the numbers again, keeping pet and range.
watch(
  () => props.reload,
  () => {
    pets.value = []
    void load()
  }
)
watch([petId, days], (now, before) => {
  if (before[0] !== null || now[1] !== before[1]) void load()
})

const locale = computed(() => props.t.locale)
const tz = computed(() => props.me.timeZone)
const o = computed(() => props.t.overview)

function series(list: Array<{ date: string; count: number }>, weekly = false) {
  return list.map((d) => ({
    key: d.date,
    label: formatDay(d.date, locale.value),
    tip: weekly ? o.value.weekOf(formatDay(d.date, locale.value)) : formatDay(d.date, locale.value),
    value: d.count
  }))
}
const care = (key: 'feed' | 'pet' | 'treat') =>
  computed(() => series((data.value?.care ?? []).map((c) => ({ date: c.date, count: c[key] }))))
const feeds = care('feed')
const petsPerDay = care('pet')
const treats = care('treat')
const focusDays = computed(() => series(data.value?.focusDays ?? []))
const focusWeeks = computed(() => series(data.value?.focusWeeks ?? [], true))
const weekTotal = computed(() => (data.value?.focusWeeks ?? []).reduce((n, w) => n + w.count, 0))
</script>

<template>
  <p v-if="state === 'loading'" class="muted">{{ t.loading }}</p>
  <p v-else-if="state === 'noPet'" class="card muted">{{ t.noPet }}</p>
  <p v-else-if="state === 'failed'" class="card error">{{ t.loadFailed }}</p>
  <div v-else-if="data" class="overview">
    <div class="filters">
      <label v-if="pets.length > 1">
        <span>{{ o.pet }}</span>
        <select v-model="petId">
          <option v-for="p in pets" :key="p.id" :value="p.id">
            {{ p.name }}{{ p.replacedAt ? '' : ` (${o.current})` }}
          </option>
        </select>
      </label>
      <div class="range" role="group">
        <button
          v-for="d in OVERVIEW_DAYS"
          :key="d"
          type="button"
          :class="{ on: d === days }"
          :aria-pressed="d === days"
          @click="days = d"
        >
          {{ o.days(d) }}
        </button>
      </div>
    </div>

    <section class="card head">
      <div>
        <h1>{{ data.pet.name }}</h1>
        <p class="muted">
          {{ o.adopted(formatDate(data.pet.adoptedAt, locale, tz)) }}
          <template v-if="data.pet.replacedAt">
            · {{ o.replaced(formatDate(data.pet.replacedAt, locale, tz)) }}</template
          >
        </p>
      </div>
      <dl class="tiles">
        <div>
          <dt>{{ o.fed }}</dt>
          <dd>{{ data.last ? Math.round(data.last.hunger) : '–' }}</dd>
        </div>
        <div>
          <dt>{{ o.happy }}</dt>
          <dd>{{ data.last ? Math.round(data.last.happiness) : '–' }}</dd>
        </div>
        <div>
          <dt>{{ o.mood }}</dt>
          <dd class="word">{{ data.last ? (t.moods[data.last.mood] ?? data.last.mood) : '–' }}</dd>
        </div>
        <div>
          <dt>{{ o.streak }}</dt>
          <dd class="word">{{ o.streakDays(data.streak) }}</dd>
        </div>
      </dl>
      <p v-if="data.last" class="muted seen">
        {{ o.lastSeen(formatDateTime(data.last.at, locale, tz)) }}
      </p>
    </section>

    <section class="card">
      <h2>{{ o.needsTitle }}</h2>
      <p class="muted note">{{ o.needsNote }}</p>
      <p v-if="data.needs.length === 0" class="muted">{{ o.noData }}</p>
      <LineChart
        v-else
        :points="data.needs"
        :from="data.from"
        :to="data.to"
        :days="data.dayKeys"
        :labels="{ hunger: o.fed, happiness: o.happy }"
        :locale="locale"
        :time-zone="tz"
      />
    </section>

    <section class="card">
      <h2>{{ o.careTitle }}</h2>
      <div class="multiples">
        <BarChart :title="o.feeds" :total="o.total(data.totals.feed)" :items="feeds" />
        <BarChart :title="o.pets" :total="o.total(data.totals.pet)" :items="petsPerDay" />
        <BarChart :title="o.treats" :total="o.total(data.totals.treat)" :items="treats" />
      </div>
    </section>

    <section class="card">
      <div class="multiples two">
        <BarChart :title="o.focusDays" :total="o.total(data.totals.focus)" :items="focusDays" />
        <BarChart :title="o.focusWeeks" :total="o.total(weekTotal)" :items="focusWeeks" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview {
  display: grid;
  /* minmax(0, ...) lets the charts shrink with the window instead of widening the page. */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.filters label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.range {
  display: flex;
  gap: 4px;
}
.range button.on {
  color: var(--accent-ink);
  background: var(--accent);
  border-color: var(--accent);
}
h1 {
  margin: 0;
  font-size: 22px;
}
h2 {
  margin: 0 0 4px;
  font-size: 15px;
}
.head p {
  margin: 4px 0 0;
}
.note {
  margin: 0 0 10px;
  font-size: 12px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}
.tiles div {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
dt {
  font-size: 12px;
  color: var(--text-secondary);
}
dd {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
dd.word {
  font-size: 18px;
}
.seen {
  font-size: 12px;
}
.multiples {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 8px;
}
.multiples.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0;
}
@media (max-width: 720px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .multiples,
  .multiples.two {
    grid-template-columns: 1fr;
  }
}
</style>
