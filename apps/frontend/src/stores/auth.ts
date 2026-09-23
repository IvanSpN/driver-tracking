import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '../api/auth'
import type { AuthUser } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const ready = ref(false)

  // Восстанавливает сессию по httpOnly-куке при полной перезагрузке страницы.
  async function init() {
    try {
      const { data } = await authApi.fetchMe()
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
  }

  async function login(email: string, password: string) {
    const { data } = await authApi.login(email, password)
    user.value = data.user
  }

  async function logout() {
    await authApi.logout()
    user.value = null
  }

  return { user, ready, init, login, logout }
})
