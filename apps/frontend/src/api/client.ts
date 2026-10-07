import axios, { type InternalAxiosRequestConfig } from 'axios'
import { computed, ref } from 'vue'

type SessionRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean
  _sessionEpoch?: number
  _tokenVersion?: number
  _wasSessionExpired?: boolean
}

function authAction(config: InternalAxiosRequestConfig) {
  return /\/auth\/(login|refresh|logout)\/?(?:[?#]|$)/.exec(config.url ?? '')?.[1]
}

export function createApiClient() {
  const pendingRequests = ref(0)
  const trackedRequests = new WeakSet<object>()
  const requestsPending = computed(() => pendingRequests.value > 0)
  let refreshPromise: Promise<void> | null = null
  let tokenVersion = 0
  let sessionEpoch = 0
  let sessionExpired = false
  let sessionExpiredHandler: (() => void) | undefined

  const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
    withCredentials: true,
    timeout: 30_000,
  })

  function expireSession() {
    if (sessionExpired) return
    sessionExpired = true
    sessionExpiredHandler?.()
  }

  function finishRequest(config?: object) {
    if (config && trackedRequests.delete(config)) pendingRequests.value -= 1
  }

  function refreshSession() {
    if (!refreshPromise) {
      const epoch = sessionEpoch
      refreshPromise = apiClient
        .post('/auth/refresh')
        .then(() => {
          if (epoch !== sessionEpoch) throw new axios.CanceledError('Session changed')
          tokenVersion += 1
        })
        .catch((error: unknown) => {
          // Offline/timeouts/5xx do not mean that the refresh cookie has expired.
          if (
            epoch === sessionEpoch &&
            axios.isAxiosError(error) &&
            error.response?.status === 401
          ) {
            expireSession()
          }
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  apiClient.interceptors.request.use(async (originalConfig) => {
    const config = originalConfig as SessionRequestConfig
    trackedRequests.add(config)
    pendingRequests.value += 1
    try {
      const action = authAction(config)
      if (action === 'login' || action === 'logout') {
        // Finish any cookie rotation BEFORE login/logout sets or clears cookies.
        // Old requests must not replay under a different session afterwards.
        sessionEpoch += 1
        config._wasSessionExpired = sessionExpired
        sessionExpired = true
        await refreshPromise?.catch(() => {})
      }
      if (config._authRetry && config._sessionEpoch !== sessionEpoch) {
        throw new axios.CanceledError('Session changed', config)
      }
      config._sessionEpoch = sessionEpoch
      config._tokenVersion = tokenVersion
      return config
    } catch (error) {
      finishRequest(config)
      throw error
    }
  })

  apiClient.interceptors.response.use(
    (response) => {
      finishRequest(response.config)
      const config = response.config as SessionRequestConfig
      if (!authAction(config) && config._sessionEpoch !== sessionEpoch) {
        throw new axios.CanceledError('Session changed', config)
      }
      if (authAction(config) === 'login' && config._sessionEpoch === sessionEpoch) {
        tokenVersion += 1
        sessionExpired = false
      }
      return response
    },
    async (error: unknown) => {
      const config = axios.isAxiosError(error)
        ? (error.config as SessionRequestConfig | undefined)
        : undefined
      try {
        const action = config && authAction(config)
        if (config?._sessionEpoch === sessionEpoch && (action === 'login' || action === 'logout')) {
          sessionExpired = config._wasSessionExpired ?? false
        }
        if (
          !config ||
          !axios.isAxiosError(error) ||
          error.response?.status !== 401 ||
          authAction(config)
        ) {
          throw error
        }
        if (config._sessionEpoch !== sessionEpoch || config.signal?.aborted) {
          throw new axios.CanceledError('Request no longer active', config)
        }
        if (sessionExpired) throw error
        if (config._authRetry) {
          expireSession()
          throw error
        }

        config._authRetry = true
        // A late 401 may belong to a token already replaced by another request.
        if (config._tokenVersion === tokenVersion) await refreshSession()
        if (config._sessionEpoch !== sessionEpoch || config.signal?.aborted) {
          throw new axios.CanceledError('Request no longer active', config)
        }
        if (sessionExpired) throw error
        return await apiClient.request(config)
      } finally {
        // Keep progress active for the entire refresh + one retry, including failures.
        finishRequest(config)
      }
    },
  )

  return {
    apiClient,
    requestsPending,
    setSessionExpiredHandler(handler: () => void) {
      sessionExpiredHandler = handler
    },
  }
}

export const { apiClient, requestsPending, setSessionExpiredHandler } = createApiClient()
