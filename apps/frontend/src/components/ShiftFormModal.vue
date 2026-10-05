<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import LoadingButton from './LoadingButton.vue'
import type { Shift, ShiftInput } from '../api/shifts'

const props = defineProps<{
  open: boolean
  shift?: Shift | null
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{
  close: []
  save: [value: ShiftInput]
}>()

const form = reactive({
  startDate: '',
  endDate: '',
  note: '',
})

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

watch(
  () => [props.open, props.shift] as const,
  ([open, shift]) => {
    if (!open) return
    form.startDate = shift?.startDate ?? todayIso()
    form.endDate = shift?.endDate ?? ''
    form.note = shift?.note ?? ''
  },
  { immediate: true },
)

function submit() {
  if (props.saving) return
  emit('save', {
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    note: form.note || undefined,
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="shift ? 'Изменить вахту' : 'Новая вахта'"
    :busy="saving"
    :error="error"
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <fieldset class="form form-fields" :disabled="saving">
        <label class="field">
          <span>Дата начала</span>
          <input v-model="form.startDate" type="date" required />
        </label>

        <label class="field">
          <span>Дата окончания (если известна)</span>
          <input v-model="form.endDate" type="date" />
        </label>

        <label class="field">
          <span>Заметка</span>
          <input v-model="form.note" type="text" />
        </label>

        <div class="actions">
          <button type="button" class="btn-secondary" @click="emit('close')">Отмена</button>
          <LoadingButton
            type="submit"
            class="btn-primary"
            :loading="saving"
            loading-text="Сохраняем…"
            >Сохранить</LoadingButton
          >
        </div>
      </fieldset>
    </form>
  </BaseModal>
</template>
