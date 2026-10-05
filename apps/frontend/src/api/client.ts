import axios from 'axios'
import { computed, ref } from 'vue'

const pendingRequests = ref(0)
const trackedRequests = new WeakSet<object>()
export const requestsPending = computed(() => pendingRequests.value > 0)

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
  timeout: 30_000,
})

apiClient.interceptors.request.use((config) => {
  trackedRequests.add(config)
  pendingRequests.value += 1
  return config
})

function finishRequest(config?: object) {
  if (config && trackedRequests.delete(config)) pendingRequests.value -= 1
}

apiClient.interceptors.response.use(
  (response) => {
    finishRequest(response.config)
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) finishRequest(error.config)
    return Promise.reject(error)
  },
)
