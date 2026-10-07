<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import { menuPosition } from '../utils/menuPosition'

const props = defineProps<{ driverName: string; disabled?: boolean; loading?: boolean }>()
const emit = defineEmits<{ edit: []; dismiss: [] }>()
const menuId = useId()
const trigger = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const opened = ref(false)
let cleanup: (() => void) | undefined

function closeMenu() {
  cleanup?.()
  cleanup = undefined
  opened.value = false
  if (dialog.value?.open) dialog.value.close()
}

function openMenu() {
  if (props.disabled || props.loading || !trigger.value || !dialog.value) return
  if (opened.value) return closeMenu()
  const element = dialog.value
  const visualViewport = window.visualViewport
  const viewport = {
    left: visualViewport?.offsetLeft ?? 0,
    top: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  }
  element.style.maxWidth = `${Math.max(48, viewport.width - 24)}px`
  element.style.maxHeight = `${Math.max(48, viewport.height - 24)}px`
  // The native top layer avoids clipping by the scrollable list or adjacent cards.
  element.showModal()
  const position = menuPosition(
    trigger.value.getBoundingClientRect(),
    element.getBoundingClientRect(),
    viewport,
  )
  element.style.left = `${position.left}px`
  element.style.top = `${position.top}px`
  opened.value = true
  element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })

  const onScroll = (event: Event) => {
    if (event.target !== element) closeMenu()
  }
  window.addEventListener('resize', closeMenu)
  window.addEventListener('scroll', onScroll, true)
  visualViewport?.addEventListener('resize', closeMenu)
  visualViewport?.addEventListener('scroll', closeMenu)
  cleanup = () => {
    window.removeEventListener('resize', closeMenu)
    window.removeEventListener('scroll', onScroll, true)
    visualViewport?.removeEventListener('resize', closeMenu)
    visualViewport?.removeEventListener('scroll', closeMenu)
  }
}

function choose(action: 'edit' | 'dismiss') {
  if (!opened.value || props.disabled || props.loading) return
  closeMenu()
  if (action === 'edit') emit('edit')
  else emit('dismiss')
}

watch(
  () => props.disabled || props.loading,
  (disabled) => {
    if (disabled) closeMenu()
  },
)
onBeforeUnmount(closeMenu)
</script>

<template>
  <div class="driver-menu" @click.stop>
    <button
      ref="trigger"
      type="button"
      class="btn-secondary menu-trigger"
      :aria-label="`Действия: ${driverName}`"
      aria-haspopup="dialog"
      :aria-expanded="opened"
      :aria-controls="menuId"
      :aria-busy="loading || undefined"
      :disabled="disabled || loading"
      @click="openMenu"
    >
      <LoadingSpinner v-if="loading" />
      <span v-else aria-hidden="true">⋯</span>
    </button>
    <dialog
      :id="menuId"
      ref="dialog"
      class="menu-popup"
      :aria-label="`Действия: ${driverName}`"
      @cancel.prevent="closeMenu"
      @close="closeMenu"
      @click.self="closeMenu"
    >
      <button
        type="button"
        class="menu-item"
        :disabled="disabled || loading"
        @click="choose('edit')"
      >
        Редактировать
      </button>
      <div class="menu-divider" role="separator" />
      <button
        type="button"
        class="menu-item menu-item-danger"
        :disabled="disabled || loading"
        @click="choose('dismiss')"
      >
        Уволить
      </button>
    </dialog>
  </div>
</template>

<style scoped>
.menu-trigger {
  width: 48px;
  height: 48px;
  padding: 0;
  font-size: 28px;
  line-height: 1;
}

.menu-popup {
  position: fixed;
  inset: 0 auto auto 0;
  width: 240px;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
}

.menu-popup::backdrop {
  background: transparent;
}

.menu-item {
  display: block;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.menu-divider {
  height: 1px;
  margin: 8px 4px;
  background: var(--border);
}

.menu-item-danger {
  color: #934444;
}

.menu-item:active:not(:disabled) {
  background: var(--surface-hover);
  box-shadow: inset 0 0 0 1px currentColor;
}

@media (hover: hover) {
  .menu-item:hover:not(:disabled) {
    background: var(--surface-hover);
  }
}
</style>
