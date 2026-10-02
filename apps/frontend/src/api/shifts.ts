import { apiClient } from './client'

export interface Shift {
  id: string
  driverId: string
  startDate: string
  endDate: string | null
  isOfficial: boolean
  note: string | null
}

export interface ShiftInput {
  startDate: string
  endDate?: string
  note?: string
}

export function fetchShifts(driverId: string) {
  return apiClient.get<Shift[]>(`/drivers/${driverId}/shifts`)
}

export function createShift(driverId: string, input: ShiftInput) {
  return apiClient.post<Shift>(`/drivers/${driverId}/shifts`, input)
}

export function updateShift(id: string, input: Partial<ShiftInput>) {
  return apiClient.patch<Shift>(`/shifts/${id}`, input)
}

export function deleteShift(id: string) {
  return apiClient.delete(`/shifts/${id}`)
}
