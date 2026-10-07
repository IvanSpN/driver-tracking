import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import * as driversApi from '../api/drivers'
import type { Driver, DriverInput } from '../api/drivers'
import { getErrorMessage } from '../utils/errors'

export type OfficialFilter = 'all' | 'official' | 'unofficial'

// Сколько считаем список свежим: при входе в этот интервал сеть не дёргаем.
const CACHE_TTL_MS = 45_000
const ARCHIVED_PREF_KEY = 'drivers.showArchived'

function readArchivedPref(): boolean {
  try {
    return localStorage.getItem(ARCHIVED_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export const useDriversStore = defineStore('drivers', () => {
  const drivers = ref<Driver[]>([])
  const loading = ref(false)
  const error = ref('')
  let latestRequest = 0
  let lastLoadedAt = 0
  let lastKey = ''
  const officialFilter = ref<OfficialFilter>('all')
  // Переключатель живёт в Настройках; запоминаем выбор между сессиями.
  const showArchived = ref(readArchivedPref())

  watch(showArchived, (value) => {
    try {
      localStorage.setItem(ARCHIVED_PREF_KEY, value ? '1' : '0')
    } catch {
      // приватный режим / недоступное хранилище — не критично
    }
  })

  // Набор данных зависит от фильтра и показа уволенных — кэш привязан к ним.
  function listKey() {
    return `${officialFilter.value}|${showArchived.value}`
  }

  // Любая правка делает кэш неактуальным — следующий fetchList сходит в сеть.
  function invalidate() {
    lastLoadedAt = 0
  }

  async function fetchList(force = false) {
    const key = listKey()
    if (!force && key === lastKey && Date.now() - lastLoadedAt < CACHE_TTL_MS) {
      // Данные свежие и под тот же фильтр — показываем из памяти, без запроса.
      return
    }
    const request = ++latestRequest
    loading.value = true
    error.value = ''
    try {
      const { data } = await driversApi.fetchDrivers({
        official: officialFilter.value === 'all' ? undefined : officialFilter.value === 'official',
        archived: showArchived.value,
      })
      if (request !== latestRequest) return
      // сверху — кому должны больше всего
      drivers.value = [...data].sort((a, b) => (b.totalDueMinor ?? 0) - (a.totalDueMinor ?? 0))
      lastKey = key
      lastLoadedAt = Date.now()
    } catch (cause) {
      if (request === latestRequest) error.value = getErrorMessage(cause)
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  async function create(input: DriverInput) {
    await driversApi.createDriver(input)
    invalidate()
  }

  async function update(id: string, input: Partial<DriverInput>) {
    await driversApi.updateDriver(id, input)
    invalidate()
  }

  async function remove(id: string) {
    await driversApi.deleteDriver(id)
    invalidate()
  }

  async function restore(id: string) {
    await driversApi.restoreDriver(id)
    invalidate()
  }

  async function deletePermanently(id: string) {
    await driversApi.deleteDriverPermanently(id)
    drivers.value = drivers.value.filter((driver) => driver.id !== id)
    invalidate()
  }

  return {
    drivers,
    loading,
    error,
    officialFilter,
    showArchived,
    fetchList,
    create,
    update,
    remove,
    restore,
    deletePermanently,
  }
})
