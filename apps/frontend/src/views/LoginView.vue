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
            <input
              v-model="email"
              type="email"
              inputmode="email"
              required
              autocomplete="email"
              autocapitalize="none"
              :spellcheck="false"
              enterkeyhint="next"
            />
          </label>

          <label class="field">
            <span>Пароль</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              autocomplete="current-password"
              enterkeyhint="go"
            />
          </label>

          <p v-if="error" class="error-message" role="alert">{{ error }}</p>

          <LoadingButton
            type="submit"
            class="btn-primary submit-btn"
            :loading="loading"
            loading-text="Входим…"
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
  min-height: 100dvh;
  display: flex;
  padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}

.auth-card {
  width: 100%;
  max-width: 420px;
  margin: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}

.title {
  font-size: 28px;
  line-height: 1.2;
  margin: 0 0 28px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}
</style>
