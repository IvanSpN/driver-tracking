<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'

withDefaults(
  defineProps<{
    loading?: boolean
    disabled?: boolean
    loadingText?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { loadingText: 'Подождите…', type: 'button' },
)
</script>

<template>
  <button :type="type" class="loading-button" :disabled="disabled || loading" :aria-busy="loading">
    <span
      class="button-label"
      :class="{ 'button-label-hidden': loading }"
      :aria-hidden="loading || undefined"
      ><slot
    /></span>
    <span v-if="loading" class="button-progress"
      ><LoadingSpinner /><span class="progress-text">{{ loadingText }}</span></span
    >
  </button>
</template>

<style scoped>
.loading-button {
  display: inline-grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  justify-items: center;
}
.button-label,
.button-progress {
  grid-area: 1 / 1;
  min-width: 0;
  max-width: 100%;
}
.button-label-hidden {
  visibility: hidden;
}
.button-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.progress-text {
  min-width: 0;
}
</style>
