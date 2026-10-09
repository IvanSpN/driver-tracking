<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useDriversStore, type OfficialFilter } from '../stores/drivers'
import DriverFormModal from '../components/DriverFormModal.vue'
import DriverActionsMenu from '../components/DriverActionsMenu.vue'
import LoadingButton from '../components/LoadingButton.vue'
import LoadingState from '../components/LoadingState.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import type { Driver, DriverInput } from '../api/drivers'
import { formatMoneyShort } from '../utils/money'

const store = useDriversStore()
const modalOpen = ref(false)
const editingDriver = ref<Driver | null>(null)
const { activeAction, pending, error, run } = useAsyncAction()
const busy = computed(() => pending.value || store.loading)
const actionsDisabled = computed(() => busy.value || !!store.error)
const visibleDrivers = computed(() =>
  store.onShiftOnly ? store.drivers.filter((driver) => driver.currentShift) : store.drivers,
)

onMounted(() => store.fetchList())

function openCreate() {
  if (actionsDisabled.value) return
  error.value = ''
  editingDriver.value = null
  modalOpen.value = true
}

function openEdit(driver: Driver) {
  if (actionsDisabled.value) return
  error.value = ''
  editingDriver.value = driver
  modalOpen.value = true
}

async function handleSave(input: DriverInput) {
  if (actionsDisabled.value) return
  await run('save', async () => {
    if (editingDriver.value) {
      await store.update(editingDriver.value.id, input)
    } else {
      await store.create(input)
    }
    modalOpen.value = false
    await store.fetchList()
  })
}

function driverName(driver: Driver) {
  return [driver.lastName, driver.firstName, driver.middleName].filter(Boolean).join(' ')
}

// "2026-10-15" -> "15.10"
function formatDay(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}.${match[2]}` : date
}

function shiftLabel(driver: Driver): string {
  const shift = driver.currentShift
  if (!shift) return 'не на вахте'
  return shift.endDate ? `на вахте · до ${formatDay(shift.endDate)}` : 'на вахте'
}

async function handleRemove(driver: Driver) {
  if (actionsDisabled.value || driver.deletedAt) return
  if (!confirm(`Уволить ${driverName(driver)}?\n\nВодитель будет перемещён в список уволенных.`))
    return
  await run(`remove:${driver.id}`, async () => {
    await store.remove(driver.id)
    await store.fetchList()
  })
}

async function handleRestore(driver: Driver) {
  if (actionsDisabled.value) return
  await run(`restore:${driver.id}`, async () => {
    await store.restore(driver.id)
    await store.fetchList()
  })
}

async function handleDeletePermanently(driver: Driver) {
  if (actionsDisabled.value || !driver.deletedAt) return
  if (
    !confirm(
      `Удалить ${driver.lastName} ${driver.firstName} навсегда?\n\nБудут удалены все вахты, начисления и выплаты этого водителя. Восстановить данные будет невозможно.`,
    )
  )
    return
  await run(`delete:${driver.id}`, async () => {
    await store.deletePermanently(driver.id)
    await store.fetchList()
  })
}

function changeFilter(filter: OfficialFilter) {
  if (busy.value || (store.officialFilter === filter && !store.error)) return
  store.officialFilter = filter
  void store.fetchList()
}
</script>

<template>
  <div class="page drivers-page">
    <div class="drivers-toolbar">
      <div class="filters">
        <div class="segmented" role="group" aria-label="Статус водителей">
          <button
            type="button"
            :class="{ active: store.officialFilter === 'all' }"
            :aria-pressed="store.officialFilter === 'all'"
            :disabled="busy"
            @click="changeFilter('all')"
          >
            Все
          </button>
          <button
            type="button"
            :class="{ active: store.officialFilter === 'official' }"
            :aria-pressed="store.officialFilter === 'official'"
            :disabled="busy"
            @click="changeFilter('official')"
          >
            Белая
          </button>
          <button
            type="button"
            :class="{ active: store.officialFilter === 'unofficial' }"
            :aria-pressed="store.officialFilter === 'unofficial'"
            :disabled="busy"
            @click="changeFilter('unofficial')"
          >
            Чёрная
          </button>
        </div>

        <button
          type="button"
          class="shift-toggle"
          :class="{ active: store.onShiftOnly }"
          :aria-pressed="store.onShiftOnly"
          @click="store.onShiftOnly = !store.onShiftOnly"
        >
          На вахте
        </button>
      </div>
    </div>

    <section class="drivers-scroll" tabindex="0" aria-label="Список водителей">
      <p v-if="error && !modalOpen" class="error-message" role="alert">{{ error }}</p>
      <div v-if="store.error" class="request-error" role="alert">
        <p class="error-message">Не удалось загрузить список. {{ store.error }}</p>
        <button class="btn-secondary" :disabled="busy" @click="store.fetchList()">
          Повторить загрузку
        </button>
      </div>
      <LoadingState
        v-if="store.loading"
        :compact="store.drivers.length > 0"
        :label="store.drivers.length ? 'Обновляем список водителей…' : 'Загружаем водителей…'"
      />
      <p v-else-if="!store.error && store.drivers.length === 0" class="empty-state">
        Пока нет водителей.
      </p>
      <p v-else-if="!store.error && visibleDrivers.length === 0" class="empty-state">
        Сейчас никто не на вахте.
      </p>

      <ul v-if="visibleDrivers.length" class="driver-list" :aria-busy="store.loading">
        <li
          v-for="driver in visibleDrivers"
          :key="driver.id"
          class="driver-row"
          :class="{
            'driver-row-unofficial': !driver.isOfficial,
            'driver-row-active': !driver.deletedAt,
            'driver-row-archived': !!driver.deletedAt,
          }"
        >
          <div class="driver-main">
            <RouterLink
              :to="{ name: 'driver-detail', params: { id: driver.id } }"
              class="driver-name"
            >
              {{ driver.lastName }} {{ driver.firstName }} {{ driver.middleName }}
            </RouterLink>

            <div
              v-if="driver.deletedAt || driver.currentShift || driver.totalDueMinor"
              class="driver-meta"
            >
              <span v-if="driver.deletedAt" class="badge badge-dismissed driver-tag">Уволен</span>
              <span v-else-if="driver.currentShift" class="driver-shift">
                {{ shiftLabel(driver) }}
              </span>
              <span
                v-if="driver.totalDueMinor"
                class="driver-due"
                :class="{ overpaid: driver.totalDueMinor < 0 }"
              >
                {{ driver.totalDueMinor > 0 ? 'долг' : 'переплата' }}:
                {{ formatMoneyShort(Math.abs(driver.totalDueMinor)) }}
              </span>
            </div>
          </div>

          <DriverActionsMenu
            v-if="!driver.deletedAt"
            class="driver-menu-position"
            :driver-name="driverName(driver)"
            :disabled="actionsDisabled"
            :loading="activeAction === `remove:${driver.id}`"
            @edit="openEdit(driver)"
            @dismiss="handleRemove(driver)"
          />

          <div v-if="driver.deletedAt" class="driver-actions">
            <LoadingButton
              class="btn-secondary"
              :disabled="actionsDisabled"
              :loading="activeAction === `restore:${driver.id}`"
              loading-text="Восстанавливаем…"
              @click="handleRestore(driver)"
              >Восстановить</LoadingButton
            >
            <LoadingButton
              class="btn-secondary danger"
              :disabled="actionsDisabled"
              :loading="activeAction === `delete:${driver.id}`"
              loading-text="Удаляем…"
              @click="handleDeletePermanently(driver)"
              >Удалить навсегда</LoadingButton
            >
          </div>
        </li>
      </ul>
    </section>

    <button
      type="button"
      class="btn-primary add-driver-button"
      aria-label="Добавить водителя"
      title="Добавить водителя"
      :disabled="actionsDisabled"
      @click="openCreate"
    >
      <span aria-hidden="true">+</span>
    </button>

    <DriverFormModal
      :open="modalOpen"
      :driver="editingDriver"
      :saving="pending"
      :error="error"
      @close="!pending && (modalOpen = false)"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.drivers-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.drivers-toolbar {
  flex-shrink: 1;
  min-height: 0;
  max-height: 75%;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.drivers-scroll {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  /* Leave room for the focus outline of the stretched card links. */
  padding: 4px;
  scroll-padding-block: 8px;
  /* Room for the floating add button so the last card is never covered. */
  padding-bottom: 84px;
}

.filters {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-bottom: 8px;
}

.filters .segmented {
  flex: 1;
  min-width: 0;
}

/* Tight on 320px: labels get every spare pixel. */
.filters .segmented button {
  padding-inline: 2px;
}

/* Same height as the segmented control; the label wraps to two lines on phones. */
.shift-toggle {
  flex: 0 0 68px;
  min-width: 0;
  min-height: calc(var(--control-height) + 10px);
  padding: 4px 6px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  cursor: pointer;
}

.shift-toggle.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.shift-toggle:active {
  box-shadow: inset 0 0 0 2px currentColor;
}

@media (hover: hover) {
  .shift-toggle:not(.active):hover {
    background: var(--surface-hover);
  }
}

.add-driver-button {
  position: fixed;
  z-index: 5;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  padding: 0;
  border-radius: 50%;
  font-size: 34px;
  font-weight: 400;
  line-height: 1;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
}

.add-driver-button > span {
  transform: translateY(-1px);
}

.driver-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Compact row: name + one meta line + actions menu, several fit on one screen. */
.driver-row {
  position: relative;
  isolation: isolate;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.driver-row-unofficial {
  --border: var(--driver-unofficial-border);
  --positive: var(--driver-unofficial-positive);

  background: var(--driver-unofficial-surface);
  /* Тёмная полоса у левого края — признак «чёрной» (у «белой» её нет). */
  box-shadow: inset 4px 0 0 0 var(--accent);
}

.driver-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.driver-name {
  display: block;
  min-width: 0;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.3;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Extend the native link over the card; keep independent controls above it. */
.driver-name::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: var(--radius);
}

.driver-name:focus-visible {
  outline: none;
}

.driver-name:focus-visible::after {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.driver-name:active::after {
  background: rgb(0 0 0 / 0.04);
}

.driver-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
  font-size: 14px;
}

.driver-tag {
  font-size: 12px;
  padding: 2px 8px;
}

.driver-shift {
  min-width: 0;
  color: var(--positive);
}

.driver-due {
  min-width: 0;
  /* Push the debt to the right edge of the meta line. */
  margin-left: auto;
  text-align: right;
  font-weight: 650;
  color: var(--danger);
}

.driver-due.overpaid {
  font-weight: 600;
  color: var(--text-muted);
}

.driver-menu-position {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
}

/* Archived drivers keep a taller layout with the restore / delete actions. */
.driver-row-archived {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.driver-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.driver-actions > * {
  position: relative;
  z-index: 2;
  flex: 1 1 145px;
  min-width: 0;
}

@media (hover: hover) {
  .driver-name:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
}

@media (max-height: 500px) {
  /* On short landscape screens / enlarged text, keep every control reachable. */
  .drivers-toolbar {
    max-height: 55%;
  }
}

@media (min-width: 600px) {
  .segmented {
    min-width: 300px;
    max-width: 420px;
  }

  .filters {
    justify-content: flex-start;
  }

  .filters .segmented {
    flex: 0 1 420px;
  }

  .shift-toggle {
    flex: 0 0 auto;
    padding-inline: 18px;
  }

  .driver-row {
    padding: 12px 16px;
  }

  .driver-actions {
    justify-content: flex-end;
  }

  .driver-actions > * {
    flex: 0 1 auto;
  }
}
</style>
