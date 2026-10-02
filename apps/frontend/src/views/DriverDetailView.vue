<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
import { formatMoney } from '../utils/money'

const route = useRoute()
const router = useRouter()
const driverId = route.params.id as string

const driver = ref<Driver | null>(null)
const periods = ref<PayrollPeriod[]>([])
const shifts = ref<Shift[]>([])
const loading = ref(false)
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

function extractErrorMessage(e: unknown): string {
  const message = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  return (Array.isArray(message) ? message[0] : message) ?? 'Не удалось выполнить запрос'
}

async function load() {
  loading.value = true
  try {
    const [driverRes, payrollRes, shiftsRes] = await Promise.all([
      driversApi.fetchDriver(driverId),
      payrollApi.fetchPayroll(driverId),
      shiftsApi.fetchShifts(driverId),
    ])
    driver.value = driverRes.data
    periods.value = payrollRes.data
    shifts.value = shiftsRes.data
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openShiftModal(shift?: Shift) {
  editingShift.value = shift ?? null
  shiftModalOpen.value = true
}

async function handleShiftSave(input: ShiftInput) {
  try {
    if (editingShift.value) {
      await shiftsApi.updateShift(editingShift.value.id, input)
    } else {
      await shiftsApi.createShift(driverId, input)
    }
    shiftModalOpen.value = false
    await load()
  } catch (e) {
    alert(extractErrorMessage(e))
  }
}

async function handleDeleteShift(shift: Shift) {
  if (!confirm('Удалить эту вахту?')) return
  await shiftsApi.deleteShift(shift.id)
  await load()
}

function openAccrualModal(period?: PayrollPeriod) {
  accrualModalInitial.value = period
    ? { period: period.period, whiteMinor: period.accruedWhiteMinor, blackMinor: period.accruedBlackMinor, note: null }
    : { period: currentPeriod(), whiteMinor: 0, blackMinor: 0, note: null }
  accrualModalOpen.value = true
}

async function handleAccrualSave(input: { period: string; whiteMinor: number; blackMinor: number; note?: string }) {
  await payrollApi.upsertAccrual(driverId, input.period, input)
  accrualModalOpen.value = false
  await load()
}

async function handleDeleteAccrual(period: PayrollPeriod) {
  if (!confirm(`Удалить начисление за ${period.period}?`)) return
  await payrollApi.deleteAccrual(driverId, period.period)
  await load()
}

function openPaymentModal(period?: string) {
  editingPayment.value = null
  paymentDefaultPeriod.value = period ?? currentPeriod()
  paymentModalOpen.value = true
}

function openEditPayment(payment: Payment) {
  editingPayment.value = payment
  paymentModalOpen.value = true
}

async function handlePaymentSave(input: PaymentInput) {
  if (editingPayment.value) {
    await payrollApi.updatePayment(editingPayment.value.id, input)
  } else {
    await payrollApi.createPayment(driverId, input)
  }
  paymentModalOpen.value = false
  await load()
}

async function handleDeletePayment(payment: Payment) {
  if (!confirm('Удалить эту выплату?')) return
  await payrollApi.deletePayment(payment.id)
  await load()
}

function toggleExpand(period: string) {
  expandedPeriod.value = expandedPeriod.value === period ? null : period
}
</script>

<template>
  <div class="page">
    <button type="button" class="back-link" @click="router.push({ name: 'drivers' })">← Водители</button>

    <template v-if="driver">
      <h1>{{ driver.lastName }} {{ driver.firstName }} {{ driver.middleName }}</h1>

      <div class="tabs">
        <button type="button" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">Обзор</button>
        <button type="button" :class="{ active: tab === 'shifts' }" @click="tab = 'shifts'">Вахты</button>
        <button type="button" :class="{ active: tab === 'payroll' }" @click="tab = 'payroll'">Зарплата</button>
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
          <button type="button" class="btn-primary" @click="openShiftModal()">Новая вахта</button>
        </div>

        <p v-if="shifts.length === 0" class="empty-state">Вахт пока не было.</p>

        <ul v-else class="shift-list">
          <li v-for="shift in shifts" :key="shift.id" class="shift-row">
            <span class="shift-dates">{{ shift.startDate }} — {{ shift.endDate ?? 'по настоящее время' }}</span>
            <span class="badge" :class="shift.isOfficial ? 'badge-outline' : 'badge-solid'">
              {{ shift.isOfficial ? 'белая' : 'чёрная' }}
            </span>
            <span class="shift-actions">
              <button type="button" class="btn-link" @click="openShiftModal(shift)">
                {{ shift.endDate ? 'изменить' : 'закрыть вахту' }}
              </button>
              <button type="button" class="btn-link danger" @click="handleDeleteShift(shift)">удалить</button>
            </span>
          </li>
        </ul>
      </section>

      <section v-else class="payroll">
        <div class="payroll-actions">
          <button type="button" class="btn-primary" @click="openAccrualModal()">Начисление за месяц</button>
          <button type="button" class="btn-secondary" @click="openPaymentModal()">Добавить выплату</button>
        </div>

        <p v-if="loading" class="empty-state">Загрузка…</p>
        <p v-else-if="periods.length === 0" class="empty-state">Пока нет начислений и выплат.</p>

        <div v-else class="period-list">
          <div v-for="p in periods" :key="p.period" class="period-card">
            <div class="period-header" @click="toggleExpand(p.period)">
              <span class="period-name">{{ p.period }}</span>

              <span class="period-sums">
                <span>начислено: {{ formatMoney(p.accruedWhiteMinor + p.accruedBlackMinor) }}</span>
                <span>выплачено: {{ formatMoney(p.paidWhiteMinor + p.paidBlackMinor) }}</span>
                <span
                  class="due"
                  :class="{ overpaid: p.dueWhiteMinor + p.dueBlackMinor < 0 }"
                >
                  остаток: {{ formatMoney(p.dueWhiteMinor + p.dueBlackMinor) }}
                </span>
              </span>

              <div class="period-actions" @click.stop>
                <button type="button" class="btn-link" @click="openAccrualModal(p)">изменить начисление</button>
                <button type="button" class="btn-link" @click="openPaymentModal(p.period)">+ выплата</button>
                <button type="button" class="btn-link danger" @click="handleDeleteAccrual(p)">удалить начисление</button>
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
                  <span class="badge" :class="payment.channel === 'WHITE' ? 'badge-outline' : 'badge-solid'">
                    {{ payment.channel === 'WHITE' ? 'белая' : 'чёрная' }}
                  </span>
                  <span class="payment-type">{{ payment.type === 'ADVANCE' ? 'аванс' : 'зарплата' }}</span>
                  <span class="payment-amount">{{ formatMoney(payment.amountMinor) }}</span>
                  <span class="payment-date">{{ payment.paidAt }}</span>
                  <span class="payment-actions">
                    <button type="button" class="btn-link" @click="openEditPayment(payment)">изменить</button>
                    <button type="button" class="btn-link danger" @click="handleDeletePayment(payment)">удалить</button>
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
      @close="accrualModalOpen = false"
      @save="handleAccrualSave"
    />

    <PaymentFormModal
      :open="paymentModalOpen"
      :payment="editingPayment"
      :default-period="paymentDefaultPeriod"
      @close="paymentModalOpen = false"
      @save="handlePaymentSave"
    />

    <ShiftFormModal
      :open="shiftModalOpen"
      :shift="editingShift"
      @close="shiftModalOpen = false"
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
