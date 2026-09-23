import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as driversApi from '../api/drivers'
import type { Driver, DriverInput } from '../api/drivers'

export type OfficialFilter = 'all' | 'official' | 'unofficial'

export const useDriversStore = defineStore('drivers', () => {
  const drivers = ref<Driver[]>([])
  const loading = ref(false)
  const officialFilter = ref<OfficialFilter>('all')
  const showArchived = ref(false)

  async function fetchList() {
    loading.value = true
    try {
      const { data } = await driversApi.fetchDrivers({
        official: officialFilter.value === 'all' ? undefined : officialFilter.value === 'official',
        archived: showArchived.value,
      })
      drivers.value = data
    } finally {
      loading.value = false
    }
  }

  async function create(input: DriverInput) {
    await driversApi.createDriver(input)
    await fetchList()
  }

  async function update(id: string, input: Partial<DriverInput>) {
    await driversApi.updateDriver(id, input)
    await fetchList()
  }

  async function remove(id: string) {
    await driversApi.deleteDriver(id)
    await fetchList()
  }

  async function restore(id: string) {
    await driversApi.restoreDriver(id)
    await fetchList()
  }

  return { drivers, loading, officialFilter, showArchived, fetchList, create, update, remove, restore }
})
