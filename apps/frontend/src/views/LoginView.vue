<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoadingButton from '../components/LoadingButton.vue'
import { useAsyncAction } from '../composables/useAsyncAction'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const { pending: loading, error, run } = useAsyncAction()

async function submit() {
  await run('login', async () => {
    await auth.login(email.value, password.value)
    await router.push({ name: 'dashboard' })
  })
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-card">
      <h1 class="title">Вход</h1>

      <form class="form" :aria-busy="loading" @submit.prevent="submit">
        <fieldset class="form form-fields" :disabled="loading">
          <label class="field">
            <span>Email</span>
            <input v-model="email" type="email" required autocomplete="email" />
          </label>

          <label class="field">
            <span>Пароль</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              autocomplete="current-password"
            />
          </label>

          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <LoadingButton type="submit" class="submit-btn" :loading="loading" loading-text="Входим…"
            >Войти</LoadingButton
          >
        </fieldset>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg);
}

.auth-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}

.title {
  font-size: 16px;
  margin: 0 0 20px;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.field input {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 10px;
  font-size: 16px;
  color: var(--text);
  background: var(--bg);
}

.field input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.submit-btn {
  margin-top: 4px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-fg);
  padding: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
