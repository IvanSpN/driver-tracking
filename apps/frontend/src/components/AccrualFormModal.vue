<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import LoadingButton from './LoadingButton.vue'
import type { AccrualInput } from '../api/payroll'

export interface AccrualFormValue {
  period: string
  amountMinor: number
  note: string | null
}

const props = defineProps<{
  open: boolean
  initial: AccrualFormValue | null
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{
  close: []
  save: [value: AccrualInput & { period: string }]
}>()

const form = reactive({
  period: '',
  amountRub: 0,
  note: '',
})

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    form.period = initial?.period ?? ''
    form.amountRub = (initial?.amountMinor ?? 0) / 100
    form.note = initial?.note ?? ''
  },
  { immediate: true },
)

function submit() {
  if (props.saving) return
  emit('save', {
    period: form.period,
    amountMinor: Math.round(form.amountRub * 100),
    note: form.note || undefined,
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Начисление за месяц"
    :busy="saving"
    :error="error"
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <fieldset class="form form-fields" :disabled="saving">
        <label class="field">
          <span>Месяц</span>
          <input v-model="form.period" type="month" required />
        </label>

        <label class="field">
          <span>Сумма за месяц, ₽</span>
          <input
            v-model.number="form.amountRub"
            type="number"
            inputmode="decimal"
            enterkeyhint="next"
            min="0"
            step="0.01"
            required
          />
        </label>

        <label class="field">
          <span>Заметка</span>
          <input v-model="form.note" type="text" enterkeyhint="done" />
        </label>

        <div class="actions">
          <LoadingButton
            type="submit"
            class="btn-primary"
            :loading="saving"
            loading-text="Сохраняем…"
            >Сохранить</LoadingButton
          >
          <button type="button" class="btn-secondary" @click="emit('close')">Отмена</button>
        </div>
      </fieldset>
    </form>
  </BaseModal>
</template>
