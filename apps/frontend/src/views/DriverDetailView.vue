<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import * as driversApi from '../api/drivers'
import type { Driver } from '../api/drivers'
import * as payrollApi from '../api/payroll'
import type { AccrualInput, PayrollPeriod, Payment, PaymentInput } from '../api/payroll'
import * as shiftsApi from '../api/shifts'
import type { Shift, ShiftInput } from '../api/shifts'
import AccrualFormModal from '../components/AccrualFormModal.vue'
import type { AccrualFormValue } from '../components/AccrualFormModal.vue'
import PaymentFormModal from '../components/PaymentFormModal.vue'
import ShiftFormModal from '../components/ShiftFormModal.vue'
import LoadingButton from '../components/LoadingButton.vue'
import LoadingState from '../components/LoadingState.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import { useSwipeTabs } from '../composables/useSwipeTabs'
import { getErrorMessage } from '../utils/errors'
import { formatMoney } from '../utils/money'
import { formatPeriod } from '../utils/period'

const route = useRoute()
const driverId = route.params.id as string

const driver = ref<Driver | null>(null)
const periods = ref<PayrollPeriod[]>([])
const shifts = ref<Shift[]>([])
const loading = ref(false)
const loadError = ref('')
const { activeAction, pending, error, run } = useAsyncAction()
const actionsDisabled = computed(() => loading.value || pending.value || !!loadError.value)
const tabOrder = ['payroll', 'shifts', 'overview'] as const
const tab = ref<(typeof tabOrder)[number]>('payroll')
const expandedPeriod = ref<string | null>(null)

const accrualModalOpen = ref(false)
const accrualModalInitial = ref<AccrualFormValue | null>(null)

const paymentModalOpen = ref(false)
const editingPayment = ref<Payment | null>(null)
const paymentDefaultPeriod = ref('')

const shiftModalOpen = ref(false)
const editingShift = ref<Shift | null>(null)

const { onTouchStart, onTouchMove, onTouchEnd, cancelSwipe } = useSwipeTabs(
  tab,
  tabOrder,
  () =>
    !loading.value &&
    !pending.value &&
    !accrualModalOpen.value &&
    !paymentModalOpen.value &&
    !shiftModalOpen.value,
)

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
        amountMinor: period.accruedWhiteMinor + period.accruedBlackMinor,
        note: null,
      }
    : { period: currentPeriod(), amountMinor: 0, note: null }
  accrualModalOpen.value = true
}

async function handleAccrualSave(input: AccrualInput & { period: string }) {
  if (actionsDisabled.value) return
  await run('save-accrual', async () => {
    await payrollApi.upsertAccrual(driverId, input.period, input)
    accrualModalOpen.value = false
    await load()
  })
}

async function handleDeleteAccrual(period: PayrollPeriod) {
  if (actionsDisabled.value) return
  if (!confirm(`Удалить начисление за ${formatPeriod(period.period)}?`)) return
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
  <div
    class="page driver-detail"
    :class="{
      'driver-detail-official': driver?.isOfficial === true,
      'driver-detail-unofficial': driver?.isOfficial === false,
    }"
  >
    <RouterLink class="btn-secondary back-link" :to="{ name: 'drivers' }"> ← Водители </RouterLink>

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

      <div class="segmented tabs" role="group" aria-label="Раздел карточки водителя">
        <button
          type="button"
          :class="{ active: tab === 'payroll' }"
          :aria-pressed="tab === 'payroll'"
          @click="tab = 'payroll'"
        >
          Зарплата
        </button>
        <button
          type="button"
          :class="{ active: tab === 'shifts' }"
          :aria-pressed="tab === 'shifts'"
          @click="tab = 'shifts'"
        >
          Вахты
        </button>
        <button
          type="button"
          :class="{ active: tab === 'overview' }"
          :aria-pressed="tab === 'overview'"
          @click="tab = 'overview'"
        >
          Обзор
        </button>
      </div>

      <div
        class="tab-content"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend.passive="onTouchEnd"
        @touchcancel.passive="cancelSwipe"
      >
        <dl v-if="tab === 'overview'" class="overview">
          <div class="field-row">
            <dt class="label">Телефон</dt>
            <dd>
              <a v-if="driver.phone" class="phone-link" :href="'tel:' + driver.phone">{{
                driver.phone
              }}</a>
              <span v-else>—</span>
            </dd>
          </div>
          <div class="field-row">
            <dt class="label">Статус</dt>
            <dd>
              <span class="badge" :class="driver.isOfficial ? 'badge-outline' : 'badge-solid'">
                {{ driver.isOfficial ? 'белая' : 'чёрная' }}
              </span>
            </dd>
          </div>
          <div class="field-row">
            <dt class="label">Заметка</dt>
            <dd class="driver-note">{{ driver.note || '—' }}</dd>
          </div>
        </dl>

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
                  class="btn-secondary"
                  :disabled="actionsDisabled"
                  @click="openShiftModal(shift)"
                >
                  Изменить даты / вахту
                </button>
                <LoadingButton
                  class="btn-secondary danger"
                  :disabled="actionsDisabled"
                  :loading="activeAction === `delete-shift:${shift.id}`"
                  loading-text="Удаляем…"
                  @click="handleDeleteShift(shift)"
                  >Удалить</LoadingButton
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
              <div class="period-header">
                <h2 class="period-name">{{ formatPeriod(p.period) }}</h2>

                <dl class="period-sums">
                  <div>
                    <dt>Начислено</dt>
                    <dd>{{ formatMoney(p.accruedWhiteMinor + p.accruedBlackMinor) }}</dd>
                  </div>
                  <div>
                    <dt>Выплачено</dt>
                    <dd>{{ formatMoney(p.paidWhiteMinor + p.paidBlackMinor) }}</dd>
                  </div>
                  <div class="due" :class="{ overpaid: p.dueWhiteMinor + p.dueBlackMinor < 0 }">
                    <dt>Остаток</dt>
                    <dd>{{ formatMoney(p.dueWhiteMinor + p.dueBlackMinor) }}</dd>
                  </div>
                </dl>

                <div class="period-actions">
                  <button
                    type="button"
                    class="btn-secondary"
                    :disabled="actionsDisabled"
                    @click="openAccrualModal(p)"
                  >
                    Изменить начисление
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    :disabled="actionsDisabled"
                    @click="openPaymentModal(p.period)"
                  >
                    Добавить выплату
                  </button>
                  <LoadingButton
                    class="btn-secondary danger"
                    :disabled="actionsDisabled"
                    :loading="activeAction === `delete-accrual:${p.period}`"
                    loading-text="Удаляем…"
                    @click="handleDeleteAccrual(p)"
                    >Удалить начисление</LoadingButton
                  >
                </div>
              </div>

              <button
                type="button"
                class="period-toggle"
                :aria-expanded="expandedPeriod === p.period"
                :aria-controls="'payments-' + p.period"
                @click="toggleExpand(p.period)"
              >
                <span
                  >{{ expandedPeriod === p.period ? 'Скрыть выплаты' : 'Показать выплаты' }} ({{
                    p.payments.length
                  }})</span
                >
                <span aria-hidden="true">{{ expandedPeriod === p.period ? '−' : '+' }}</span>
              </button>

              <div
                v-show="expandedPeriod === p.period"
                :id="'payments-' + p.period"
                class="payments-block"
              >
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
                        class="btn-secondary"
                        :disabled="actionsDisabled"
                        @click="openEditPayment(payment)"
                      >
                        Изменить
                      </button>
                      <LoadingButton
                        class="btn-secondary danger"
                        :disabled="actionsDisabled"
                        :loading="activeAction === `delete-payment:${payment.id}`"
                        loading-text="Удаляем…"
                        @click="handleDeletePayment(payment)"
                        >Удалить</LoadingButton
                      >
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
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
.driver-detail {
  --driver-card-surface: var(--surface);
}

.driver-detail-official {
  background: var(--driver-card-surface);
}

.driver-detail-unofficial {
  --driver-card-surface: var(--driver-unofficial-surface);
  --border: var(--driver-unofficial-border);
  --positive: var(--driver-unofficial-positive);

  background: var(--driver-card-surface);
}

.empty-state {
  background: var(--driver-card-surface);
}

.back-link {
  margin-bottom: 20px;
}

.tabs {
  margin-bottom: 24px;
}

.tab-content {
  /* Keep empty tabs swipeable without constraining growing content. */
  min-height: 240px;
  min-width: 0;
}

.overview {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 4px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--driver-card-surface);
}

.field-row {
  display: grid;
  gap: 6px;
  padding-block: 16px;
  min-width: 0;
}

.field-row + .field-row {
  border-top: 1px solid var(--border);
}

.field-row dd {
  min-width: 0;
  margin: 0;
}

.label {
  color: var(--text-muted);
  font-size: 16px;
}

.phone-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--text);
  text-underline-offset: 4px;
}

.driver-note {
  white-space: pre-wrap;
}

.payroll-actions,
.shifts-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.shift-list,
.payment-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shift-row {
  background: var(--driver-card-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.shift-dates {
  flex: 1 1 220px;
  min-width: 0;
  font-size: 17px;
  font-weight: 600;
}

.shift-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex-basis: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.shift-actions > * {
  flex: 1 1 180px;
  min-width: 0;
}

.period-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.period-card {
  min-width: 0;
  background: var(--driver-card-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.period-header {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.period-name {
  margin: 0;
  font-weight: 700;
  font-size: 22px;
}

.period-sums {
  display: grid;
  gap: 12px;
  margin: 0;
  font-size: 16px;
  color: var(--text-muted);
}

.period-sums > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.period-sums dd {
  min-width: 0;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.period-sums .due {
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-weight: 600;
}

.period-sums .due dd {
  color: var(--danger);
  font-size: 20px;
}

.period-sums .due.overpaid dd {
  color: var(--text-muted);
}

.period-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.period-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  border: 0;
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius) var(--radius);
  padding: 14px 16px;
  background: var(--bg);
  color: var(--text);
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.period-toggle[aria-expanded='true'] {
  border-radius: 0;
}

.period-toggle:active {
  background: var(--surface-hover);
}

.payments-block {
  padding: 16px;
  border-top: 1px solid var(--border);
}

.payment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-size: 16px;
}

.payment-row + .payment-row {
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.payment-type {
  text-align: right;
}

.payment-amount {
  grid-column: 1 / -1;
  font-weight: 650;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.payment-date {
  grid-column: 1 / -1;
  color: var(--text-muted);
}

.payment-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.payment-actions > * {
  flex: 1 1 120px;
  min-width: 0;
}

@media (min-width: 600px) {
  .tabs {
    max-width: 480px;
  }

  .field-row {
    grid-template-columns: minmax(100px, 1fr) minmax(0, 3fr);
    align-items: baseline;
    gap: 20px;
  }

  .payroll-actions,
  .shifts-actions,
  .period-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .shift-actions > * {
    flex: 0 1 auto;
  }

  .period-header,
  .payments-block {
    padding: 24px;
  }

  .period-sums {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .period-sums > div {
    display: block;
  }

  .period-sums .due {
    padding: 0;
    border: 0;
  }

  .payment-row {
    display: flex;
    flex-wrap: wrap;
  }

  .payment-amount {
    flex: 1 1 auto;
  }

  .payment-actions {
    margin-left: auto;
  }
}
</style>
