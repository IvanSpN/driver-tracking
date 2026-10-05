import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as driversApi from '../api/drivers'
import type { Driver, DriverInput } from '../api/drivers'
import { getErrorMessage } from '../utils/errors'

export type OfficialFilter = 'all' | 'official' | 'unofficial'

export const useDriversStore = defineStore('drivers', () => {
  const drivers = ref<Driver[]>([])
  const loading = ref(false)
  const error = ref('')
  let latestRequest = 0
  const officialFilter = ref<OfficialFilter>('all')
  const showArchived = ref(false)

  async function fetchList() {
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
    } catch (cause) {
      if (request === latestRequest) error.value = getErrorMessage(cause)
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  async function create(input: DriverInput) {
    await driversApi.createDriver(input)
  }

  async function update(id: string, input: Partial<DriverInput>) {
    await driversApi.updateDriver(id, input)
  }

  async function remove(id: string) {
    await driversApi.deleteDriver(id)
  }

  async function restore(id: string) {
    await driversApi.restoreDriver(id)
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
  }
})
