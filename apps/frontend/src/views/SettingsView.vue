<script setup lang="ts">
import { useRouter } from 'vue-router'
import LoadingButton from '../components/LoadingButton.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const { pending: loggingOut, error, run } = useAsyncAction()

async function handleLogout() {
  await run('logout', async () => {
    await auth.logout()
    await router.push({ name: 'login' })
  })
}
</script>

<template>
  <div class="page">
    <h1>Настройки</h1>
    <p class="empty-state">Тема и смена пароля появятся здесь позже.</p>

    <section class="account" aria-labelledby="account-heading">
      <h2 id="account-heading">Аккаунт</h2>
      <p v-if="auth.user" class="account-details">
        Вы вошли как <strong>{{ auth.user.fullName }}</strong>
        <span class="account-email">{{ auth.user.email }}</span>
      </p>
      <p v-if="error" class="error-message logout-error" role="alert">{{ error }}</p>
      <LoadingButton
        class="btn-secondary logout-btn"
        :loading="loggingOut"
        loading-text="Выходим…"
        @click="handleLogout"
        >Выйти</LoadingButton
      >
    </section>
  </div>
</template>

<style scoped>
.account {
  margin-top: 24px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.account h2 {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.3;
}

.account-details {
  margin: 0 0 20px;
  font-size: 17px;
}

.account-email {
  display: block;
  color: var(--text-muted);
}

.logout-btn {
  width: 100%;
}

.logout-error {
  margin-bottom: 12px;
}

@media (min-width: 600px) {
  .logout-btn {
    width: auto;
    min-width: 160px;
  }
}
</style>
