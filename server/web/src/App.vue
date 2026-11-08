<script setup lang="ts">
/** The dashboard shell: login, then Overview and Events (hash routes), TH/EN switch (FR-95..98). */
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import type { Me } from '../../src/dashTypes.ts'
import { api, LoggedOut } from './api.ts'
import { lang, setLang, textFor } from './i18n.ts'
import EventsPage from './pages/EventsPage.vue'
import LoginPage from './pages/LoginPage.vue'
import OverviewPage from './pages/OverviewPage.vue'

const t = computed(() => textFor(lang.value))
/** undefined while checking the session, null when logged out. */
const me = ref<Me | null | undefined>(undefined)
const route = ref(location.hash === '#/events' ? 'events' : 'overview')
/** Bumped by the Refresh button; the open page loads its data again. */
const reload = ref(0)

const onHash = (): void => {
  route.value = location.hash === '#/events' ? 'events' : 'overview'
}
onMounted(async () => {
  window.addEventListener('hashchange', onHash)
  try {
    me.value = await api.me()
  } catch {
    me.value = null
  }
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))

watchEffect(() => {
  document.documentElement.lang = lang.value
  document.title =
    route.value === 'events' ? `${t.value.events.title} · ${t.value.appName}` : t.value.appName
})

/** Any page call that finds the session gone brings the login back. */
function onError(err: unknown): void {
  if (err instanceof LoggedOut) me.value = null
}

async function logout(): Promise<void> {
  await api.logout().catch(() => undefined)
  me.value = null
}
</script>

<template>
  <div class="shell">
    <header>
      <div class="brand">🐱 {{ t.appName }}</div>
      <nav v-if="me">
        <a href="#/" :class="{ on: route === 'overview' }">{{ t.nav.overview }}</a>
        <a href="#/events" :class="{ on: route === 'events' }">{{ t.nav.events }}</a>
      </nav>
      <div class="tools">
        <button type="button" @click="setLang(lang === 'th' ? 'en' : 'th')">
          {{ t.nav.language }}
        </button>
        <button v-if="me" type="button" @click="reload++">↻ {{ t.nav.refresh }}</button>
        <button v-if="me" type="button" @click="logout">{{ t.nav.logout }}</button>
      </div>
    </header>

    <main>
      <p v-if="me === undefined" class="muted">{{ t.loading }}</p>
      <LoginPage v-else-if="me === null" :t="t" @logged-in="(next: Me) => (me = next)" />
      <OverviewPage
        v-else-if="route === 'overview'"
        :t="t"
        :me="me"
        :reload="reload"
        @error="onError"
      />
      <EventsPage v-else :t="t" :me="me" :reload="reload" @error="onError" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px;
}
header {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.brand {
  font-size: 18px;
  font-weight: 700;
}
nav {
  display: flex;
  gap: 4px;
}
nav a {
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
}
nav a.on {
  color: var(--text-primary);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.tools {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
</style>
