<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as driversApi from '../api/drivers'
import type { Driver } from '../api/drivers'
import * as payrollApi from '../api/payroll'
import type { PayrollPeriod, Payment, PaymentInput } from '../api/payroll'
import * as shiftsApi from '../api/shifts'
import type { Shift, ShiftInput } from '../api/shifts'
import AccrualFormModal from '../components/AccrualFormModal.vue'
import type { AccrualFormValue } from '../components/AccrualFormModal.vue'
import PaymentFormModal from '../components/PaymentFormModal.vue'
import ShiftFormModal from '../components/ShiftFormModal.vue'
import LoadingButton from '../components/LoadingButton.vue'
import LoadingState from '../components/LoadingState.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import { getErrorMessage } from '../utils/errors'
import { formatMoney } from '../utils/money'

const route = useRoute()
const router = useRouter()
const driverId = route.params.id as string

const driver = ref<Driver | null>(null)
const periods = ref<PayrollPeriod[]>([])
const shifts = ref<Shift[]>([])
const loading = ref(false)
const loadError = ref('')
const { activeAction, pending, error, run } = useAsyncAction()
const actionsDisabled = computed(() => loading.value || pending.value || !!loadError.value)
const tab = ref<'overview' | 'shifts' | 'payroll'>('overview')
const expandedPeriod = ref<string | null>(null)

const accrualModalOpen = ref(false)
const accrualModalInitial = ref<AccrualFormValue | null>(null)

const paymentModalOpen = ref(false)
const editingPayment = ref<Payment | null>(null)
const paymentDefaultPeriod = ref('')

const shiftModalOpen = ref(false)
const editingShift = ref<Shift | null>(null)

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function load() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const [driverRes, payrollRes, shiftsRes] = await Promise.allSettled([
      driversApi.fetchDriver(driverId),
      payrollApi.fetchPayroll(driverId),
      shiftsApi.fetchShifts(driverId),
    ])
    if (driverRes.status === 'rejected') throw driverRes.reason
    if (payrollRes.status === 'rejected') throw payrollRes.reason
    if (shiftsRes.status === 'rejected') throw shiftsRes.reason
    driver.value = driverRes.value.data
    periods.value = payrollRes.value.data
    shifts.value = shiftsRes.value.data
  } catch (cause) {
    loadError.value = getErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openShiftModal(shift?: Shift) {
  if (actionsDisabled.value) return
  error.value = ''
  editingShift.value = shift ?? null
  shiftModalOpen.value = true
}

async function handleShiftSave(input: ShiftInput) {
  if (actionsDisabled.value) return
  await run('save-shift', async () => {
    if (editingShift.value) {
      await shiftsApi.updateShift(editingShift.value.id, input)
    } else {
      await shiftsApi.createShift(driverId, input)
    }
    shiftModalOpen.value = false
    await load()
  })
}

async function handleDeleteShift(shift: Shift) {
  if (actionsDisabled.value) return
  if (!confirm('Удалить эту вахту?')) return
  await run(`delete-shift:${shift.id}`, async () => {
    await shiftsApi.deleteShift(shift.id)
    await load()
  })
}

function openAccrualModal(period?: PayrollPeriod) {
  if (actionsDisabled.value) return
  error.value = ''
  accrualModalInitial.value = period
    ? {
        period: period.period,
        whiteMinor: period.accruedWhiteMinor,
        blackMinor: period.accruedBlackMinor,
        note: null,
      }
    : { period: currentPeriod(), whiteMinor: 0, blackMinor: 0, note: null }
  accrualModalOpen.value = true
}

async function handleAccrualSave(input: {
  period: string
  whiteMinor: number
  blackMinor: number
  note?: string
}) {
  if (actionsDisabled.value) return
  await run('save-accrual', async () => {
    await payrollApi.upsertAccrual(driverId, input.period, input)
    accrualModalOpen.value = false
    await load()
  })
}

async function handleDeleteAccrual(period: PayrollPeriod) {
  if (actionsDisabled.value) return
  if (!confirm(`Удалить начисление за ${period.period}?`)) return
  await run(`delete-accrual:${period.period}`, async () => {
    await payrollApi.deleteAccrual(driverId, period.period)
    await load()
  })
}

function openPaymentModal(period?: string) {
  if (actionsDisabled.value) return
  error.value = ''
  editingPayment.value = null
  paymentDefaultPeriod.value = period ?? currentPeriod()
  paymentModalOpen.value = true
}

function openEditPayment(payment: Payment) {
  if (actionsDisabled.value) return
  error.value = ''
  editingPayment.value = payment
  paymentModalOpen.value = true
}

async function handlePaymentSave(input: PaymentInput) {
  if (actionsDisabled.value) return
  await run('save-payment', async () => {
    if (editingPayment.value) {
      await payrollApi.updatePayment(editingPayment.value.id, input)
    } else {
      await payrollApi.createPayment(driverId, input)
    }
    paymentModalOpen.value = false
    await load()
  })
}

async function handleDeletePayment(payment: Payment) {
  if (actionsDisabled.value) return
  if (!confirm('Удалить эту выплату?')) return
  await run(`delete-payment:${payment.id}`, async () => {
    await payrollApi.deletePayment(payment.id)
    await load()
  })
}

function toggleExpand(period: string) {
  expandedPeriod.value = expandedPeriod.value === period ? null : period
}
</script>

<template>
  <div class="page">
    <button type="button" class="back-link" @click="router.push({ name: 'drivers' })">
      ← Водители
    </button>

    <LoadingState
      v-if="loading"
      :compact="!!driver"
      :label="driver ? 'Обновляем данные водителя…' : 'Загружаем карточку водителя…'"
    />
    <div v-if="loadError" class="request-error" role="alert">
      <p class="error-message">Не удалось загрузить данные водителя. {{ loadError }}</p>
      <button class="btn-secondary" :disabled="loading || pending" @click="load">
        Повторить загрузку
      </button>
    </div>
    <p
      v-if="error && !shiftModalOpen && !accrualModalOpen && !paymentModalOpen"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>

    <template v-if="driver">
      <h1>{{ driver.lastName }} {{ driver.firstName }} {{ driver.middleName }}</h1>

      <div class="tabs">
        <button type="button" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">
          Обзор
        </button>
        <button type="button" :class="{ active: tab === 'shifts' }" @click="tab = 'shifts'">
          Вахты
        </button>
        <button type="button" :class="{ active: tab === 'payroll' }" @click="tab = 'payroll'">
          Зарплата
        </button>
      </div>

      <section v-if="tab === 'overview'" class="overview">
        <div class="field-row">
          <span class="label">Телефон</span>
          <span>{{ driver.phone || '—' }}</span>
        </div>
        <div class="field-row">
          <span class="label">Статус</span>
          <span class="badge" :class="driver.isOfficial ? 'badge-outline' : 'badge-solid'">
            {{ driver.isOfficial ? 'белая' : 'чёрная' }}
          </span>
        </div>
        <div class="field-row">
          <span class="label">Заметка</span>
          <span>{{ driver.note || '—' }}</span>
        </div>
      </section>

      <section v-else-if="tab === 'shifts'" class="shifts">
        <div class="shifts-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="actionsDisabled"
            @click="openShiftModal()"
          >
            Новая вахта
          </button>
        </div>

        <p v-if="shifts.length === 0" class="empty-state">Вахт пока не было.</p>

        <ul v-else class="shift-list">
          <li v-for="shift in shifts" :key="shift.id" class="shift-row">
            <span class="shift-dates"
              >{{ shift.startDate }} — {{ shift.endDate ?? 'по настоящее время' }}</span
            >
            <span class="badge" :class="shift.isOfficial ? 'badge-outline' : 'badge-solid'">
              {{ shift.isOfficial ? 'белая' : 'чёрная' }}
            </span>
            <span class="shift-actions">
              <button
                type="button"
                class="btn-link"
                :disabled="actionsDisabled"
                @click="openShiftModal(shift)"
              >
                {{ shift.endDate ? 'изменить' : 'закрыть вахту' }}
              </button>
              <LoadingButton
                class="btn-link danger"
                :disabled="actionsDisabled"
                :loading="activeAction === `delete-shift:${shift.id}`"
                loading-text="Удаляем…"
                @click="handleDeleteShift(shift)"
                >удалить</LoadingButton
              >
            </span>
          </li>
        </ul>
      </section>

      <section v-else class="payroll">
        <div class="payroll-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="actionsDisabled"
            @click="openAccrualModal()"
          >
            Начисление за месяц
          </button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="actionsDisabled"
            @click="openPaymentModal()"
          >
            Добавить выплату
          </button>
        </div>

        <p v-if="periods.length === 0" class="empty-state">Пока нет начислений и выплат.</p>

        <div v-else class="period-list">
          <div v-for="p in periods" :key="p.period" class="period-card">
            <div class="period-header" @click="toggleExpand(p.period)">
              <span class="period-name">{{ p.period }}</span>

              <span class="period-sums">
                <span>начислено: {{ formatMoney(p.accruedWhiteMinor + p.accruedBlackMinor) }}</span>
                <span>выплачено: {{ formatMoney(p.paidWhiteMinor + p.paidBlackMinor) }}</span>
                <span class="due" :class="{ overpaid: p.dueWhiteMinor + p.dueBlackMinor < 0 }">
                  остаток: {{ formatMoney(p.dueWhiteMinor + p.dueBlackMinor) }}
                </span>
              </span>

              <div class="period-actions" @click.stop>
                <button
                  type="button"
                  class="btn-link"
                  :disabled="actionsDisabled"
                  @click="openAccrualModal(p)"
                >
                  изменить начисление
                </button>
                <button
                  type="button"
                  class="btn-link"
                  :disabled="actionsDisabled"
                  @click="openPaymentModal(p.period)"
                >
                  + выплата
                </button>
                <LoadingButton
                  class="btn-link danger"
                  :disabled="actionsDisabled"
                  :loading="activeAction === `delete-accrual:${p.period}`"
                  loading-text="Удаляем…"
                  @click="handleDeleteAccrual(p)"
                  >удалить начисление</LoadingButton
                >
              </div>
            </div>

            <div v-if="expandedPeriod === p.period" class="payments-block">
              <div class="channel-breakdown">
                <div>
                  Белая: начислено {{ formatMoney(p.accruedWhiteMinor) }}, выплачено
                  {{ formatMoney(p.paidWhiteMinor) }}, остаток {{ formatMoney(p.dueWhiteMinor) }}
                </div>
                <div>
                  Чёрная: начислено {{ formatMoney(p.accruedBlackMinor) }}, выплачено
                  {{ formatMoney(p.paidBlackMinor) }}, остаток {{ formatMoney(p.dueBlackMinor) }}
                </div>
              </div>

              <p v-if="p.payments.length === 0" class="empty-state">Выплат ещё не было.</p>
              <ul v-else class="payment-rows">
                <li v-for="payment in p.payments" :key="payment.id" class="payment-row">
                  <span
                    class="badge"
                    :class="payment.channel === 'WHITE' ? 'badge-outline' : 'badge-solid'"
                  >
                    {{ payment.channel === 'WHITE' ? 'белая' : 'чёрная' }}
                  </span>
                  <span class="payment-type">{{
                    payment.type === 'ADVANCE' ? 'аванс' : 'зарплата'
                  }}</span>
                  <span class="payment-amount">{{ formatMoney(payment.amountMinor) }}</span>
                  <span class="payment-date">{{ payment.paidAt }}</span>
                  <span class="payment-actions">
                    <button
                      type="button"
                      class="btn-link"
                      :disabled="actionsDisabled"
                      @click="openEditPayment(payment)"
                    >
                      изменить
                    </button>
                    <LoadingButton
                      class="btn-link danger"
                      :disabled="actionsDisabled"
                      :loading="activeAction === `delete-payment:${payment.id}`"
                      loading-text="Удаляем…"
                      @click="handleDeletePayment(payment)"
                      >удалить</LoadingButton
                    >
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </template>

    <AccrualFormModal
      :open="accrualModalOpen"
      :initial="accrualModalInitial"
      :saving="pending"
      :error="error"
      @close="!pending && (accrualModalOpen = false)"
      @save="handleAccrualSave"
    />

    <PaymentFormModal
      :open="paymentModalOpen"
      :payment="editingPayment"
      :default-period="paymentDefaultPeriod"
      :saving="pending"
      :error="error"
      @close="!pending && (paymentModalOpen = false)"
      @save="handlePaymentSave"
    />

    <ShiftFormModal
      :open="shiftModalOpen"
      :shift="editingShift"
      :saving="pending"
      :error="error"
      @close="!pending && (shiftModalOpen = false)"
      @save="handleShiftSave"
    />
  </div>
</template>

<style scoped>
.back-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 12px;
}

.page h1 {
  font-size: 20px;
  margin: 0 0 16px;
}

.tabs {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 20px;
}

.tabs button {
  border: none;
  background: var(--bg);
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-muted);
}

.tabs button.active {
  background: var(--accent);
  color: var(--accent-fg);
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 420px;
}

.field-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.label {
  color: var(--text-muted);
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.badge-outline {
  border: 1px solid var(--text);
  color: var(--text);
}

.badge-solid {
  background: var(--text);
  color: var(--bg);
}

.payroll-actions,
.shifts-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.shift-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.shift-row {
  background: var(--surface);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.shift-dates {
  font-size: 14px;
}

.shift-actions {
  display: flex;
  gap: 12px;
}

.empty-state {
  color: var(--text-muted);
  font-size: 14px;
}

.period-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.period-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  cursor: pointer;
  background: var(--surface);
}

.period-name {
  font-weight: 600;
  font-size: 14px;
  min-width: 70px;
}

.period-sums {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-muted);
}

.due {
  font-weight: 600;
  color: var(--danger);
}

.due.overpaid {
  color: var(--text-muted);
  font-weight: 400;
}

.period-actions {
  display: flex;
  gap: 12px;
}

.payments-block {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}

.channel-breakdown {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.payment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
}

.payment-amount {
  font-weight: 600;
}

.payment-date {
  color: var(--text-muted);
}

.payment-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}
</style>
