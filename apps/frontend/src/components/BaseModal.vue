<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string; busy?: boolean; error?: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let cleanup: (() => void) | undefined

function requestClose() {
  if (!props.busy) emit('close')
}

watch(
  [() => props.open, dialog],
  ([open, element]) => {
    cleanup?.()
    cleanup = undefined
    if (!open || !element) {
      element?.close()
      return
    }

    // Native dialogs keep focus inside and make the page behind them inert.
    if (!element.open) element.showModal()
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const resize = () => {
      // Do not counteract the user's pinch zoom.
      if (!viewport || viewport.scale !== 1) return
      element.style.setProperty('--modal-viewport-height', `${viewport.height}px`)
      element.style.setProperty('--modal-viewport-top', `${viewport.offsetTop}px`)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    cleanup = () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      document.documentElement.style.overflow = previousOverflow
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  dialog.value?.close()
  cleanup?.()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="overlay"
    :aria-label="title"
    :aria-busy="busy"
    @cancel.prevent="requestClose"
    @click.self="requestClose"
  >
    <div v-if="open" class="modal">
      <div class="modal-header">
        <h2 class="title">{{ title }}</h2>
        <button
          type="button"
          class="btn-secondary modal-close"
          aria-label="Закрыть окно"
          :disabled="busy"
          autofocus
          @click="requestClose"
        >
          ×
        </button>
      </div>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <slot />
    </div>
  </dialog>
</template>
