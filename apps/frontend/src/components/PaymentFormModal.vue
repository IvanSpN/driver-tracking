<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import ClearableNumberInput from './ClearableNumberInput.vue'
import LoadingButton from './LoadingButton.vue'
import type { Payment, PayChannel, PaymentType, PaymentMethod, PaymentInput } from '../api/payroll'
import { formatMoney } from '../utils/money'

const props = withDefaults(
  defineProps<{
    open: boolean
    payment?: Payment | null
    defaultPeriod: string
    defaultType?: PaymentType
    // Предзаполненная сумма новой выплаты (для зарплаты — остаток за месяц), в копейках.
    defaultAmountMinor?: number
    // Остаток (начислено − выплачено) по месяцам, в копейках; ключ — «ГГГГ-ММ».
    dueByPeriod?: Record<string, number>
    // false — «чёрный» водитель: выплата всегда чёрная, выбор канала не нужен.
    driverIsOfficial?: boolean
    saving?: boolean
    error?: string
  }>(),
  // Absent boolean props are cast to false by Vue; "not loaded yet" must stay undefined.
  { driverIsOfficial: undefined },
)
const emit = defineEmits<{
  close: []
  save: [value: PaymentInput]
}>()

const form = reactive({
  period: '',
  channel: 'WHITE' as PayChannel,
  type: 'ADVANCE' as PaymentType,
  // '' — поле пустое (после «очистить» или у новой выплаты без предложенной суммы).
  amountRub: '' as number | '',
  paidAt: '',
  method: 'CASH' as PaymentMethod,
  note: '',
})

const blackOnly = computed(() => props.driverIsOfficial === false)

// Подсказка под суммой: остаток по выбранному месяцу (нет начисления — нет подсказки).
const dueHint = computed(() => {
  const due = props.dueByPeriod?.[form.period]
  if (due === undefined) return ''
  return due < 0
    ? `Переплата за месяц: ${formatMoney(-due)}`
    : `Остаток за месяц: ${formatMoney(due)}`
})

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

watch(
  () =>
    [
      props.open,
      props.payment,
      props.defaultPeriod,
      props.defaultType,
      props.defaultAmountMinor,
      props.driverIsOfficial,
    ] as const,
  ([open, payment, defaultPeriod, defaultType, defaultAmountMinor, driverIsOfficial]) => {
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
      form.channel = driverIsOfficial === false ? 'BLACK' : 'WHITE'
      // Первая выплата месяца — аванс; если аванс уже был — по умолчанию зарплата.
      form.type = defaultType ?? 'ADVANCE'
      form.amountRub = defaultAmountMinor ? defaultAmountMinor / 100 : ''
      form.paidAt = todayIso()
      form.method = 'CASH'
      form.note = ''
    }
  },
  { immediate: true },
)

function submit() {
  if (props.saving) return
  emit('save', {
    period: form.period,
    channel: form.channel,
    type: form.type,
    amountMinor: Math.round(Number(form.amountRub) * 100),
    paidAt: form.paidAt,
    method: form.method,
    note: form.note || undefined,
  })
}
</script>

<template>
  <BaseModal
    class="modal-compact"
    :open="open"
    :title="payment ? 'Изменить выплату' : 'Новая выплата'"
    :busy="saving"
    :error="error"
    @close="emit('close')"
  >
    <form class="form form-compact" @submit.prevent="submit">
      <fieldset class="form form-fields form-compact" :disabled="saving">
        <div class="field-grid">
          <label class="field field-wide">
            <span>Месяц</span>
            <input v-model="form.period" type="month" required />
          </label>

          <label v-if="!blackOnly" class="field">
            <span>Оплата</span>
            <select v-model="form.channel" required>
              <option value="WHITE">Белая</option>
              <option value="BLACK">Чёрная</option>
            </select>
          </label>

          <label class="field" :class="{ 'field-wide': blackOnly }">
            <span>Тип</span>
            <select v-model="form.type">
              <option value="ADVANCE">Аванс</option>
              <option value="SALARY">Зарплата</option>
            </select>
          </label>

          <label class="field field-wide">
            <span>Сумма, ₽</span>
            <ClearableNumberInput
              v-model="form.amountRub"
              inputmode="decimal"
              enterkeyhint="done"
              min="0.01"
              step="0.01"
              placeholder="0"
              :aria-describedby="dueHint ? 'payment-due-hint' : undefined"
              required
            />
            <span v-if="dueHint" id="payment-due-hint" class="field-hint">{{ dueHint }}</span>
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

          <label class="field field-wide">
            <span>Заметка</span>
            <input v-model="form.note" type="text" enterkeyhint="done" />
          </label>
        </div>

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
