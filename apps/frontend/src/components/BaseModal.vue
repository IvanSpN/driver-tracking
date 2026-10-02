<script setup lang="ts">
defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="modal">
      <h2 class="title">{{ title }}</h2>
      <slot />
    </div>
  </div>
</template>
