<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })

// '' — поле пустое.
const model = defineModel<number | ''>({ required: true })
const input = ref<HTMLInputElement | null>(null)

function clear() {
  model.value = ''
  // Keep the keyboard open so a new amount can be typed right away.
  input.value?.focus()
}
</script>

<template>
  <span class="input-clearable">
    <input ref="input" v-model.number="model" type="number" v-bind="$attrs" />
    <button
      v-if="model !== ''"
      type="button"
      class="input-clear"
      aria-label="Очистить сумму"
      @mousedown.prevent
      @click="clear"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="currentColor" />
        <path
          d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6"
          fill="none"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </span>
</template>
