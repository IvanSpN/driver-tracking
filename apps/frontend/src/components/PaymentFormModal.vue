<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Payment, PayChannel, PaymentType, PaymentMethod, PaymentInput } from '../api/payroll'

const props = defineProps<{ open: boolean; payment?: Payment | null; defaultPeriod: string }>()
const emit = defineEmits<{
  close: []
  save: [value: PaymentInput]
}>()

const form = reactive({
  period: '',
  channel: 'WHITE' as PayChannel,
  type: 'ADVANCE' as PaymentType,
  amountRub: 0,
  paidAt: '',
  method: 'CASH' as PaymentMethod,
  note: '',
})

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

watch(
  () => [props.open, props.payment, props.defaultPeriod] as const,
  ([open, payment, defaultPeriod]) => {
    if (!open) return
    if (payment) {
      form.period = payment.period
      form.channel = payment.channel
      form.type = payment.type
      form.amountRub = payment.amountMinor / 100
      form.paidAt = payment.paidAt
      form.method = payment.method
      form.note = payment.note ?? ''
    } else {
      form.period = defaultPeriod
      form.channel = 'WHITE'
      form.type = 'ADVANCE'
      form.amountRub = 0
      form.paidAt = todayIso()
      form.method = 'CASH'
      form.note = ''
    }
  },
  { immediate: true },
)

function submit() {
  emit('save', {
    period: form.period,
    channel: form.channel,
    type: form.type,
    amountMinor: Math.round(form.amountRub * 100),
    paidAt: form.paidAt,
    method: form.method,
    note: form.note || undefined,
  })
}
</script>

<template>
  <BaseModal :open="open" :title="payment ? 'Изменить выплату' : 'Новая выплата'" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Месяц</span>
        <input v-model="form.period" type="month" required />
      </label>

      <label class="field">
        <span>Канал</span>
        <select v-model="form.channel">
          <option value="WHITE">Белая</option>
          <option value="BLACK">Чёрная</option>
        </select>
      </label>

      <label class="field">
        <span>Тип</span>
        <select v-model="form.type">
          <option value="ADVANCE">Аванс</option>
          <option value="SALARY">Зарплата</option>
        </select>
      </label>

      <label class="field">
        <span>Сумма, ₽</span>
        <input v-model.number="form.amountRub" type="number" min="1" step="1" required />
      </label>

      <label class="field">
        <span>Дата выплаты</span>
        <input v-model="form.paidAt" type="date" required />
      </label>

      <label class="field">
        <span>Способ</span>
        <select v-model="form.method">
          <option value="CASH">Наличные</option>
          <option value="BANK">Банк</option>
          <option value="CARD">Карта</option>
          <option value="OTHER">Другое</option>
        </select>
      </label>

      <label class="field">
        <span>Заметка</span>
        <input v-model="form.note" type="text" />
      </label>

      <div class="actions">
        <button type="button" class="btn-secondary" @click="emit('close')">Отмена</button>
        <button type="submit" class="btn-primary">Сохранить</button>
      </div>
    </form>
  </BaseModal>
</template>
