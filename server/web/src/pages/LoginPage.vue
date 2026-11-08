<script setup lang="ts">
import { ref } from 'vue'
import type { Me } from '../../../src/dashTypes.ts'
import { api, ApiError } from '../api.ts'
import type { Text } from '../i18n.ts'

const props = defineProps<{ t: Text }>()
const emit = defineEmits<{ loggedIn: [me: Me] }>()

const name = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    emit('loggedIn', await api.login(name.value.trim(), password.value))
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0
    error.value =
      status === 401
        ? props.t.login.wrong
        : status === 429
          ? props.t.login.tooMany
          : props.t.login.failed
  } finally {
    busy.value = false
    password.value = ''
  }
}
</script>

<template>
  <form class="card login" @submit.prevent="submit">
    <h1>{{ t.login.title }}</h1>
    <label>
      <span>{{ t.login.name }}</span>
      <input v-model="name" autocomplete="username" required autofocus />
    </label>
    <label>
      <span>{{ t.login.password }}</span>
      <input v-model="password" type="password" autocomplete="current-password" required />
    </label>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <button class="primary" type="submit" :disabled="busy">{{ t.login.submit }}</button>
  </form>
</template>

<style scoped>
.login {
  max-width: 360px;
  margin: 48px auto;
  display: grid;
  gap: 14px;
}
h1 {
  margin: 0;
  font-size: 20px;
}
label {
  display: grid;
  gap: 6px;
}
.error {
  margin: 0;
}
</style>
