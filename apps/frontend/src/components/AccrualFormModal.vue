<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import LoadingButton from './LoadingButton.vue'

export interface AccrualFormValue {
  period: string
  whiteMinor: number
  blackMinor: number
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
  save: [value: { period: string; whiteMinor: number; blackMinor: number; note?: string }]
}>()

const form = reactive({
  period: '',
  whiteRub: 0,
  blackRub: 0,
  note: '',
})

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    form.period = initial?.period ?? ''
    form.whiteRub = (initial?.whiteMinor ?? 0) / 100
    form.blackRub = (initial?.blackMinor ?? 0) / 100
    form.note = initial?.note ?? ''
  },
  { immediate: true },
)

function submit() {
  if (props.saving) return
  emit('save', {
    period: form.period,
    whiteMinor: Math.round(form.whiteRub * 100),
    blackMinor: Math.round(form.blackRub * 100),
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
          <span>Белая, ₽</span>
          <input v-model.number="form.whiteRub" type="number" min="0" step="1" required />
        </label>

        <label class="field">
          <span>Чёрная, ₽</span>
          <input v-model.number="form.blackRub" type="number" min="0" step="1" required />
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
