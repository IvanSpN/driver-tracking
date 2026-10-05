<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import LoadingState from './components/LoadingState.vue'
import RequestProgress from './components/RequestProgress.vue'

const auth = useAuthStore()
</script>

<template>
  <RequestProgress />
  <div v-if="!auth.ready" class="app-startup" aria-busy="true">
    <LoadingState label="Открываем приложение…" />
  </div>
  <RouterView v-else />
</template>

<style scoped>
.app-startup {
  min-height: 100dvh;
  display: grid;
  place-items: center;
}
</style>
