import { apiClient } from './client'

export interface Driver {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  phone: string | null
  isOfficial: boolean
  note: string | null
  deletedAt: string | null
  // приходит только со списка (GET /drivers)
  totalDueMinor?: number
  currentShift?: {
    id: string
    startDate: string
    endDate: string | null
    daysLeft: number | null
  } | null
}

export interface DriverListFilter {
  official?: boolean
  archived?: boolean
}

export interface DriverInput {
  lastName: string
  firstName: string
  middleName?: string
  phone?: string
  isOfficial: boolean
  note?: string
}

export function fetchDrivers(filter: DriverListFilter = {}) {
  const params: Record<string, string> = {}
  if (filter.official !== undefined) params.official = String(filter.official)
  if (filter.archived) params.archived = 'true'
  return apiClient.get<Driver[]>('/drivers', { params })
}

export function fetchDriver(id: string) {
  return apiClient.get<Driver>(`/drivers/${id}`)
}

export function createDriver(input: DriverInput) {
  return apiClient.post<Driver>('/drivers', input)
}

export function updateDriver(id: string, input: Partial<DriverInput>) {
  return apiClient.patch<Driver>(`/drivers/${id}`, input)
}

export function deleteDriver(id: string) {
  return apiClient.delete(`/drivers/${id}`)
}

export function restoreDriver(id: string) {
  return apiClient.post<Driver>(`/drivers/${id}/restore`)
}

export function deleteDriverPermanently(id: string) {
  return apiClient.delete(`/drivers/${id}/permanent`)
}
