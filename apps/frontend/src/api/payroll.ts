import { apiClient } from './client'

export type PayChannel = 'WHITE' | 'BLACK'
export type PaymentType = 'ADVANCE' | 'SALARY'
export type PaymentMethod = 'CASH' | 'BANK' | 'CARD' | 'OTHER'

export interface Payment {
  id: string
  driverId: string
  period: string
  channel: PayChannel
  type: PaymentType
  amountMinor: number
  paidAt: string
  method: PaymentMethod
  note: string | null
}

export interface PayrollPeriod {
  period: string
  accruedWhiteMinor: number
  accruedBlackMinor: number
  paidWhiteMinor: number
  paidBlackMinor: number
  dueWhiteMinor: number
  dueBlackMinor: number
  payments: Payment[]
}

export interface AccrualInput {
  whiteMinor: number
  blackMinor: number
  note?: string
}

export interface PaymentInput {
  period: string
  channel?: PayChannel
  type: PaymentType
  amountMinor: number
  paidAt: string
  method?: PaymentMethod
  note?: string
}

export function fetchPayroll(driverId: string, from?: string, to?: string) {
  const params: Record<string, string> = {}
  if (from) params.from = from
  if (to) params.to = to
  return apiClient.get<PayrollPeriod[]>(`/drivers/${driverId}/payroll`, { params })
}

export function upsertAccrual(driverId: string, period: string, input: AccrualInput) {
  return apiClient.put(`/drivers/${driverId}/accruals/${period}`, input)
}

export function deleteAccrual(driverId: string, period: string) {
  return apiClient.delete(`/drivers/${driverId}/accruals/${period}`)
}

export function createPayment(driverId: string, input: PaymentInput) {
  return apiClient.post<Payment>(`/drivers/${driverId}/payments`, input)
}

export function updatePayment(id: string, input: Partial<PaymentInput>) {
  return apiClient.patch<Payment>(`/payments/${id}`, input)
}

export function deletePayment(id: string) {
  return apiClient.delete(`/payments/${id}`)
}
