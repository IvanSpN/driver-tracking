import { apiClient } from './client'

export type UserRole = 'ADMIN' | 'MANAGER'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
}

export function login(email: string, password: string) {
  return apiClient.post<{ user: AuthUser }>('/auth/login', { email, password })
}

export function logout() {
  return apiClient.post('/auth/logout')
}

export function fetchMe() {
  return apiClient.get<{ user: AuthUser }>('/auth/me')
}
