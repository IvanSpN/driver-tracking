<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useDriversStore, type OfficialFilter } from '../stores/drivers'
import DriverFormModal from '../components/DriverFormModal.vue'
import LoadingButton from '../components/LoadingButton.vue'
import LoadingState from '../components/LoadingState.vue'
import { useAsyncAction } from '../composables/useAsyncAction'
import type { Driver, DriverInput } from '../api/drivers'
import { formatMoney } from '../utils/money'

const store = useDriversStore()
const modalOpen = ref(false)
const editingDriver = ref<Driver | null>(null)
const { activeAction, pending, error, run } = useAsyncAction()
const busy = computed(() => pending.value || store.loading)
const actionsDisabled = computed(() => busy.value || !!store.error)

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

async function handleRemove(driver: Driver) {
  if (actionsDisabled.value) return
  if (!confirm(`Уволить ${driver.lastName} ${driver.firstName}?`)) return
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
      <div class="header">
        <h1>Водители</h1>
        <button class="btn-primary" :disabled="actionsDisabled" @click="openCreate">
          Добавить водителя
        </button>
      </div>

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

        <label class="checkbox-field archive-toggle">
          <input
            v-model="store.showArchived"
            type="checkbox"
            :disabled="busy"
            @change="store.fetchList()"
          />
          <span>Показать уволенных</span>
        </label>
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

      <ul v-if="store.drivers.length" class="driver-list" :aria-busy="store.loading">
        <li
          v-for="driver in store.drivers"
          :key="driver.id"
          class="driver-row"
          :class="{ 'driver-row-unofficial': !driver.isOfficial }"
        >
          <div class="driver-info">
            <RouterLink
              :to="{ name: 'driver-detail', params: { id: driver.id } }"
              class="driver-name"
            >
              {{ driver.lastName }} {{ driver.firstName }} {{ driver.middleName }}
            </RouterLink>
            <span class="badge" :class="driver.isOfficial ? 'badge-outline' : 'badge-solid'">
              {{ driver.isOfficial ? 'белая' : 'чёрная' }}
            </span>
            <span v-if="driver.deletedAt" class="badge badge-dismissed">Уволен</span>
            <a v-if="driver.phone" :href="'tel:' + driver.phone" class="driver-phone">{{
              driver.phone
            }}</a>
            <span v-if="driver.currentShift" class="driver-shift">
              на вахте{{
                driver.currentShift.daysLeft !== null
                  ? `, осталось ${driver.currentShift.daysLeft} дн.`
                  : ''
              }}
            </span>
            <span
              v-if="driver.totalDueMinor"
              class="driver-due"
              :class="{ overpaid: driver.totalDueMinor < 0 }"
            >
              {{ driver.totalDueMinor > 0 ? 'долг' : 'переплата' }}:
              {{ formatMoney(Math.abs(driver.totalDueMinor)) }}
            </span>
          </div>

          <div class="driver-actions">
            <template v-if="!driver.deletedAt">
              <button
                type="button"
                class="btn-secondary"
                :disabled="actionsDisabled"
                @click="openEdit(driver)"
              >
                Редактировать
              </button>
              <LoadingButton
                class="btn-secondary danger"
                :disabled="actionsDisabled"
                :loading="activeAction === `remove:${driver.id}`"
                loading-text="Увольняем…"
                @click="handleRemove(driver)"
                >Уволить</LoadingButton
              >
            </template>
            <template v-else>
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
            </template>
          </div>
        </li>
      </ul>
    </section>

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
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.header h1 {
  margin: 0;
  flex: 1;
  min-width: 0;
}

.header > button {
  flex: 0 1 180px;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.archive-toggle {
  padding: 8px 0;
  color: var(--text-muted);
}

.driver-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.driver-row {
  position: relative;
  isolation: isolate;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.driver-row-unofficial {
  --border: var(--driver-unofficial-border);
  --positive: var(--driver-unofficial-positive);

  background: var(--driver-unofficial-surface);
}

.driver-info {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px 10px;
  flex-wrap: wrap;
}

.driver-name {
  display: flex;
  align-items: center;
  flex-basis: 100%;
  min-height: 44px;
  min-width: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text);
  text-decoration: none;
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

.driver-phone,
.driver-shift,
.driver-due {
  flex-basis: 100%;
  min-width: 0;
  font-size: 16px;
}

.driver-phone {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 44px;
  width: fit-content;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.driver-shift {
  color: var(--positive);
}

.driver-due {
  font-size: 18px;
  font-weight: 650;
  color: var(--danger);
}

.driver-due.overpaid {
  color: var(--text-muted);
}

.driver-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 16px;
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
  .header,
  .filters {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .segmented {
    min-width: 300px;
  }

  .driver-row {
    padding: 20px;
  }

  .driver-actions {
    justify-content: flex-end;
  }

  .driver-actions > * {
    flex: 0 1 auto;
  }
}
</style>
