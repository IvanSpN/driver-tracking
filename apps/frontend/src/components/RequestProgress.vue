<script setup lang="ts">
import { requestsPending } from '../api/client'
</script>

<template>
  <div
    v-if="requestsPending"
    class="request-progress"
    role="status"
    aria-label="Выполняется запрос"
  >
    <div class="progress-track" />
  </div>
</template>

<style scoped>
.request-progress {
  position: fixed;
  inset: 0 0 auto;
  height: 3px;
  z-index: 200;
  overflow: hidden;
  pointer-events: none;
  background: var(--border);
  opacity: 0;
  animation: appear 0s 0.15s forwards;
}
.progress-track {
  width: 40%;
  height: 100%;
  background: var(--accent);
  animation: progress 1.3s ease-in-out infinite;
}
@keyframes appear {
  to {
    opacity: 1;
  }
}
@keyframes progress {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(350%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-track {
    width: 100%;
    animation: none;
  }
}
</style>
