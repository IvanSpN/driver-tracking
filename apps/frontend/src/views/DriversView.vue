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

function changeFilter(filter: OfficialFilter) {
  if (busy.value || (store.officialFilter === filter && !store.error)) return
  store.officialFilter = filter
  void store.fetchList()
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Водители</h1>
      <button class="btn-primary" :disabled="actionsDisabled" @click="openCreate">
        Добавить водителя
      </button>
    </div>

    <div class="filters">
      <div class="segmented">
        <button
          type="button"
          :class="{ active: store.officialFilter === 'all' }"
          :disabled="busy"
          @click="changeFilter('all')"
        >
          Все
        </button>
        <button
          type="button"
          :class="{ active: store.officialFilter === 'official' }"
          :disabled="busy"
          @click="changeFilter('official')"
        >
          Белая
        </button>
        <button
          type="button"
          :class="{ active: store.officialFilter === 'unofficial' }"
          :disabled="busy"
          @click="changeFilter('unofficial')"
        >
          Чёрная
        </button>
      </div>

      <label class="archive-toggle">
        <input
          v-model="store.showArchived"
          type="checkbox"
          :disabled="busy"
          @change="store.fetchList()"
        />
        <span>Показать уволенных</span>
      </label>
    </div>

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
      <li v-for="driver in store.drivers" :key="driver.id" class="driver-row">
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
          <span v-if="driver.phone" class="driver-phone">{{ driver.phone }}</span>
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
            {{ driver.totalDueMinor > 0 ? 'должны' : 'переплата' }}:
            {{ formatMoney(Math.abs(driver.totalDueMinor)) }}
          </span>
        </div>

        <div class="driver-actions">
          <template v-if="!driver.deletedAt">
            <button
              type="button"
              class="btn-link"
              :disabled="actionsDisabled"
              @click="openEdit(driver)"
            >
              Редактировать
            </button>
            <LoadingButton
              class="btn-link danger"
              :disabled="actionsDisabled"
              :loading="activeAction === `remove:${driver.id}`"
              loading-text="Увольняем…"
              @click="handleRemove(driver)"
              >Уволить</LoadingButton
            >
          </template>
          <template v-else>
            <LoadingButton
              class="btn-link"
              :disabled="actionsDisabled"
              :loading="activeAction === `restore:${driver.id}`"
              loading-text="Восстанавливаем…"
              @click="handleRestore(driver)"
              >Восстановить</LoadingButton
            >
          </template>
        </div>
      </li>
    </ul>

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
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 20px;
  margin: 0;
}

.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.segmented button {
  border: none;
  background: var(--bg);
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-muted);
}

.segmented button.active {
  background: var(--accent);
  color: var(--accent-fg);
}

.archive-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}

.empty-state {
  color: var(--text-muted);
  font-size: 14px;
}

.driver-list {
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

.driver-row {
  background: var(--surface);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.driver-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.driver-name {
  font-size: 14px;
  color: var(--text);
  text-decoration: none;
}

.driver-name:hover {
  text-decoration: underline;
}

.driver-phone {
  font-size: 13px;
  color: var(--text-muted);
}

.driver-shift {
  font-size: 13px;
  color: var(--positive);
}

.driver-due {
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
}

.driver-due.overpaid {
  color: var(--text-muted);
  font-weight: 400;
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

.driver-actions {
  display: flex;
  gap: 12px;
}
</style>
