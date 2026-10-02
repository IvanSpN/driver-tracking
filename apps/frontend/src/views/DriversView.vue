<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useDriversStore } from '../stores/drivers'
import DriverFormModal from '../components/DriverFormModal.vue'
import type { Driver, DriverInput } from '../api/drivers'
import { formatMoney } from '../utils/money'

const store = useDriversStore()
const modalOpen = ref(false)
const editingDriver = ref<Driver | null>(null)

onMounted(() => store.fetchList())

function openCreate() {
  editingDriver.value = null
  modalOpen.value = true
}

function openEdit(driver: Driver) {
  editingDriver.value = driver
  modalOpen.value = true
}

async function handleSave(input: DriverInput) {
  if (editingDriver.value) {
    await store.update(editingDriver.value.id, input)
  } else {
    await store.create(input)
  }
  modalOpen.value = false
}

async function handleRemove(driver: Driver) {
  if (!confirm(`Уволить ${driver.lastName} ${driver.firstName}?`)) return
  await store.remove(driver.id)
}

async function handleRestore(driver: Driver) {
  await store.restore(driver.id)
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Водители</h1>
      <button class="btn-primary" @click="openCreate">Добавить водителя</button>
    </div>

    <div class="filters">
      <div class="segmented">
        <button
          type="button"
          :class="{ active: store.officialFilter === 'all' }"
          @click="store.officialFilter = 'all'; store.fetchList()"
        >
          Все
        </button>
        <button
          type="button"
          :class="{ active: store.officialFilter === 'official' }"
          @click="store.officialFilter = 'official'; store.fetchList()"
        >
          Белая
        </button>
        <button
          type="button"
          :class="{ active: store.officialFilter === 'unofficial' }"
          @click="store.officialFilter = 'unofficial'; store.fetchList()"
        >
          Чёрная
        </button>
      </div>

      <label class="archive-toggle">
        <input v-model="store.showArchived" type="checkbox" @change="store.fetchList()" />
        <span>Показать уволенных</span>
      </label>
    </div>

    <p v-if="store.loading" class="empty-state">Загрузка…</p>
    <p v-else-if="store.drivers.length === 0" class="empty-state">Пока нет водителей.</p>

    <ul v-else class="driver-list">
      <li v-for="driver in store.drivers" :key="driver.id" class="driver-row">
        <div class="driver-info">
          <RouterLink :to="{ name: 'driver-detail', params: { id: driver.id } }" class="driver-name">
            {{ driver.lastName }} {{ driver.firstName }} {{ driver.middleName }}
          </RouterLink>
          <span class="badge" :class="driver.isOfficial ? 'badge-outline' : 'badge-solid'">
            {{ driver.isOfficial ? 'белая' : 'чёрная' }}
          </span>
          <span v-if="driver.phone" class="driver-phone">{{ driver.phone }}</span>
          <span v-if="driver.currentShift" class="driver-shift">
            на вахте{{ driver.currentShift.daysLeft !== null ? `, осталось ${driver.currentShift.daysLeft} дн.` : '' }}
          </span>
          <span
            v-if="driver.totalDueMinor"
            class="driver-due"
            :class="{ overpaid: driver.totalDueMinor < 0 }"
          >
            {{ driver.totalDueMinor > 0 ? 'должны' : 'переплата' }}: {{ formatMoney(Math.abs(driver.totalDueMinor)) }}
          </span>
        </div>

        <div class="driver-actions">
          <template v-if="!driver.deletedAt">
            <button type="button" class="btn-link" @click="openEdit(driver)">Редактировать</button>
            <button type="button" class="btn-link danger" @click="handleRemove(driver)">Уволить</button>
          </template>
          <template v-else>
            <button type="button" class="btn-link" @click="handleRestore(driver)">Восстановить</button>
          </template>
        </div>
      </li>
    </ul>

    <DriverFormModal :open="modalOpen" :driver="editingDriver" @close="modalOpen = false" @save="handleSave" />
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
