<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'

withDefaults(defineProps<{ label?: string; compact?: boolean }>(), { label: 'Загружаем данные…' })
</script>

<template>
  <div class="loading-state" :class="{ compact }" role="status" aria-live="polite">
    <LoadingSpinner />
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 14px;
}
.loading-state :deep(.loading-spinner) {
  font-size: 24px;
}
.compact {
  min-height: 0;
  justify-content: flex-start;
  padding: 12px 0;
}
.compact :deep(.loading-spinner) {
  font-size: 16px;
}
</style>
