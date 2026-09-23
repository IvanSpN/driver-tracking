<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="page">
    <h1>Настройки</h1>
    <p class="empty-state">Тема и смена пароля появятся здесь позже.</p>
    <p v-if="auth.user" class="account">
      Вы вошли как <strong>{{ auth.user.fullName }}</strong> ({{ auth.user.email }})
    </p>
  </div>
</template>

<style scoped>
.page h1 {
  font-size: 20px;
  margin: 0 0 8px;
}

.empty-state {
  color: var(--text-muted);
  font-size: 14px;
}

.account {
  margin-top: 16px;
  font-size: 14px;
}
</style>
