import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { AxiosError } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

let server
let clientModule
let useAuthStore

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
  clientModule = await server.ssrLoadModule('/src/api/client.ts')
  ;({ useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts'))
})

after(async () => {
  await server?.close()
})

const tick = () => new Promise((resolve) => setImmediate(resolve))

function setup(client = clientModule.createApiClient()) {
  const requests = []
  const expired = []
  client.setSessionExpiredHandler(() => expired.push(true))
  client.apiClient.defaults.adapter = (config) => {
    const deferred = Promise.withResolvers()
    requests.push({
      config,
      resolve(data = {}) {
        deferred.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
      },
      reject(status, code = 'ERR_BAD_REQUEST') {
        deferred.reject(
          new AxiosError(
            'Request failed',
            code,
            config,
            undefined,
            status ? { status, data: {}, statusText: 'Error', headers: {}, config } : undefined,
          ),
        )
      },
    })
    return deferred.promise
  }
  return { ...client, requests, expired }
}

test('401 refreshes cookies then retries a write once, preserving its payload and progress', async () => {
  const { apiClient, requests, requestsPending, expired } = setup()
  const saving = apiClient.post('/drivers/driver/payments', {
    amountMinor: 12345,
    period: '2026-10',
  })
  await tick()
  requests[0].reject(401)
  await tick()
  assert.equal(requests[1].config.url, '/auth/refresh')
  assert.equal(requests[1].config.withCredentials, true)
  assert.equal(requests[1].config.timeout, 30_000)
  assert.equal(requestsPending.value, true)
  requests[1].resolve()
  await tick()
  assert.equal(requests[2].config.url, requests[0].config.url)
  assert.equal(requests[2].config.method, 'post')
  assert.equal(requests[2].config.data, requests[0].config.data)
  assert.equal(requestsPending.value, true)
  requests[2].resolve({ id: 'saved' })
  assert.equal((await saving).data.id, 'saved')
  assert.equal(requestsPending.value, false)
  assert.equal(expired.length, 0)
})

test('concurrent and late 401s share one refresh, even while retry responses are pending', async () => {
  const { apiClient, requests, requestsPending } = setup()
  const results = Promise.all(['/drivers', '/payroll', '/shifts'].map((url) => apiClient.get(url)))
  await tick()
  requests[0].reject(401)
  requests[1].reject(401)
  await tick()
  assert.equal(requests.length, 4)
  requests[3].resolve()
  await tick()
  requests[2].reject(401)
  await tick()
  assert.equal(requests.filter(({ config }) => config.url === '/auth/refresh').length, 1)
  for (const request of requests.slice(4)) request.resolve()
  await results
  assert.equal(requestsPending.value, false)
})

test('an expired refresh cookie ends the session once, without loops or replaying writes', async () => {
  const { apiClient, requests, requestsPending, expired } = setup()
  const done = Promise.allSettled([apiClient.get('/drivers'), apiClient.post('/payroll', {})])
  await tick()
  requests[0].reject(401)
  requests[1].reject(401)
  await tick()
  requests[2].reject(401)
  const results = await done
  assert.ok(results.every(({ status }) => status === 'rejected'))
  assert.equal(requests.length, 3)
  assert.equal(expired.length, 1)
  assert.equal(requestsPending.value, false)

  const late = assert.rejects(apiClient.get('/shifts'))
  await tick()
  requests[3].reject(401)
  await late
  assert.equal(requests.length, 4)
  assert.equal(expired.length, 1)
})

test('a second 401 after successful refresh stops retrying and expires the session', async () => {
  const { apiClient, requests, requestsPending, expired } = setup()
  const rejected = assert.rejects(apiClient.get('/auth/me'))
  await tick()
  requests[0].reject(401)
  await tick()
  requests[1].resolve()
  await tick()
  requests[2].reject(401)
  await rejected
  assert.equal(requests.length, 3)
  assert.equal(expired.length, 1)
  assert.equal(requestsPending.value, false)
})

test('network, timeout and server refresh failures retain the session and allow a later retry', async () => {
  for (const [status, code] of [
    [undefined, 'ERR_NETWORK'],
    [undefined, 'ECONNABORTED'],
    [503, 'ERR_BAD_RESPONSE'],
  ]) {
    const { apiClient, requests, expired, requestsPending } = setup()
    const rejected = assert.rejects(apiClient.get('/drivers'))
    await tick()
    requests[0].reject(401)
    await tick()
    requests[1].reject(status, code)
    await rejected
    assert.equal(expired.length, 0)
    assert.equal(requestsPending.value, false)
    const retry = apiClient.get('/drivers')
    await tick()
    requests[2].reject(401)
    await tick()
    requests[3].resolve()
    await tick()
    requests[4].resolve()
    await retry
    assert.equal(requestsPending.value, false)
  }
})

test('login errors and non-auth failures are never silently retried', async () => {
  for (const [url, status] of [
    ['/auth/login', 401],
    ['/drivers', 403],
    ['/payroll', 500],
  ]) {
    const { apiClient, requests, expired, requestsPending } = setup()
    const rejected = assert.rejects(apiClient.post(url, {}))
    await tick()
    requests[0].reject(status)
    await rejected
    assert.equal(requests.length, 1)
    assert.equal(expired.length, 0)
    assert.equal(requestsPending.value, false)
  }
})

test('canceling one waiting request does not cancel refresh for the others', async () => {
  const { apiClient, requests, requestsPending } = setup()
  const controller = new AbortController()
  const canceled = assert.rejects(apiClient.get('/drivers', { signal: controller.signal }), {
    code: 'ERR_CANCELED',
  })
  const other = apiClient.get('/shifts')
  await tick()
  requests[0].reject(401)
  requests[1].reject(401)
  await tick()
  controller.abort()
  requests[2].resolve()
  await tick()
  assert.equal(requests.length, 4)
  assert.equal(requests[3].config.url, '/shifts')
  requests[3].resolve()
  await Promise.all([canceled, other])
  assert.equal(requestsPending.value, false)
})

test('logout waits for cookie rotation and prevents pending requests from reviving the session', async () => {
  const { apiClient, requests, requestsPending, expired } = setup()
  const canceled = assert.rejects(apiClient.get('/drivers'), { code: 'ERR_CANCELED' })
  await tick()
  requests[0].reject(401)
  await tick()
  const logout = apiClient.post('/auth/logout')
  await tick()
  assert.equal(requests.length, 2)
  requests[1].resolve()
  await tick()
  assert.equal(requests[2].config.url, '/auth/logout')
  requests[2].resolve()
  await Promise.all([canceled, logout])
  assert.equal(requests.length, 3)
  assert.equal(expired.length, 0)
  assert.equal(requestsPending.value, false)
})

test('failed logout does not disable future token renewal', async () => {
  const { apiClient, requests, requestsPending } = setup()
  const rejected = assert.rejects(apiClient.post('/auth/logout'))
  await tick()
  requests[0].reject(undefined, 'ERR_NETWORK')
  await rejected
  const request = apiClient.get('/drivers')
  await tick()
  requests[1].reject(401)
  await tick()
  assert.equal(requests[2].config.url, '/auth/refresh')
  requests[2].resolve()
  await tick()
  requests[3].resolve()
  await request
  assert.equal(requestsPending.value, false)
})

test('a new login re-enables renewal after session expiration', async () => {
  const { apiClient, requests, expired } = setup()
  const rejected = assert.rejects(apiClient.get('/drivers'))
  await tick()
  requests[0].reject(401)
  await tick()
  requests[1].reject(401)
  await rejected
  const login = apiClient.post('/auth/login', {})
  await tick()
  requests[2].resolve({ user: { id: 'new-user' } })
  await login
  const request = apiClient.get('/drivers')
  await tick()
  requests[3].reject(401)
  await tick()
  requests[4].resolve()
  await tick()
  requests[5].resolve()
  await request
  assert.equal(expired.length, 1)
})

test('reopening the app restores /auth/me through refresh, then logout clears the user', async () => {
  setActivePinia(createPinia())
  const { requests, requestsPending } = setup(clientModule)
  const auth = useAuthStore()
  const init = auth.init()
  await tick()
  assert.equal(requests[0].config.url, '/auth/me')
  requests[0].reject(401)
  await tick()
  requests[1].resolve()
  await tick()
  requests[2].resolve({ user: { id: 'user', fullName: 'Тестовый пользователь' } })
  await init
  assert.equal(auth.ready, true)
  assert.equal(auth.user.id, 'user')
  const logout = auth.logout()
  await tick()
  requests[3].resolve()
  await logout
  assert.equal(auth.user, null)
  assert.equal(requestsPending.value, false)
})
