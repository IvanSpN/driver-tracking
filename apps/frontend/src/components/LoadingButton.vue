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
    <span v-if="loading" class="button-progress"><LoadingSpinner />{{ loadingText }}</span>
  </button>
</template>

<style scoped>
.loading-button {
  display: inline-grid;
  align-items: center;
  justify-items: center;
}
.button-label,
.button-progress {
  grid-area: 1 / 1;
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
</style>
