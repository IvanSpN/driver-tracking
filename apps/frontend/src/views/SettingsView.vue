<script setup lang="ts">
import { useRouter } from 'vue-router'
import LoadingButton from '../components/LoadingButton.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import { useAuthStore } from '../stores/auth'
import { useDriversStore } from '../stores/drivers'

const auth = useAuthStore()
const drivers = useDriversStore()
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

    <section class="card prefs" aria-labelledby="drivers-heading">
      <h2 id="drivers-heading">Водители</h2>
      <label class="checkbox-field">
        <input v-model="drivers.showArchived" type="checkbox" />
        <span>Показывать уволенных в списке</span>
      </label>
      <p class="pref-hint">
        Уволенные появятся в общем списке водителей — с действиями «Восстановить» и «Удалить
        навсегда».
      </p>
    </section>

    <section class="card account" aria-labelledby="account-heading">
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
.card {
  margin-top: 16px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.card h2 {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.3;
}

.pref-hint {
  margin: 10px 0 0;
  color: var(--text-muted);
  font-size: 15px;
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
