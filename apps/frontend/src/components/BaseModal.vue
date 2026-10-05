<script setup lang="ts">
defineProps<{ open: boolean; title: string; busy?: boolean; error?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="overlay" @click.self="!busy && emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="title" :aria-busy="busy">
      <h2 class="title">{{ title }}</h2>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <slot />
    </div>
  </div>
</template>
