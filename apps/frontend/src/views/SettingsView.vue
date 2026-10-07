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
.account {
  margin-top: 24px;
  font-size: 17px;
}
</style>
