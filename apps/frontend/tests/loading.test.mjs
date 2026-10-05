import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { AxiosError, CanceledError } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

let server
let apiClient
let requestsPending
let useAsyncAction
let useDriversStore
let getErrorMessage

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [vue()],
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
  ;({ apiClient, requestsPending } = await server.ssrLoadModule('/src/api/client.ts'))
  ;({ useAsyncAction } = await server.ssrLoadModule('/src/composables/useAsyncAction.ts'))
  ;({ useDriversStore } = await server.ssrLoadModule('/src/stores/drivers.ts'))
  ;({ getErrorMessage } = await server.ssrLoadModule('/src/utils/errors.ts'))
})

after(async () => {
  await server?.close()
})

beforeEach(() => {
  setActivePinia(createPinia())
})

function deferred() {
  return Promise.withResolvers()
}

function controlledRequests() {
  const requests = []
  apiClient.defaults.adapter = (config) => {
    const request = deferred()
    requests.push({
      config,
      resolve: (data) =>
        request.resolve({ data, status: 200, statusText: 'OK', headers: {}, config }),
      reject: (code = 'ERR_NETWORK') =>
        request.reject(new AxiosError('Request failed', code, config)),
    })
    return request.promise
  }
  return requests
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('global progress waits for every concurrent request, including failures', async () => {
  const requests = controlledRequests()
  const first = apiClient.get('/first')
  const second = apiClient.get('/second')
  const third = apiClient.get('/third')
  const failed = assert.rejects(second)
  await tick()
  assert.equal(requestsPending.value, true)
  requests[1].reject()
  await failed
  assert.equal(requestsPending.value, true)
  requests[0].resolve({})
  await first
  assert.equal(requestsPending.value, true)
  requests[2].resolve({})
  await third
  assert.equal(requestsPending.value, false)
})

test('timeout and cancellation both release global progress', async () => {
  const requests = controlledRequests()
  const timedOut = apiClient.get('/slow')
  const rejected = assert.rejects(timedOut)
  await tick()
  assert.equal(requests[0].config.timeout, 30_000)
  requests[0].reject('ECONNABORTED')
  await rejected
  assert.equal(requestsPending.value, false)

  apiClient.defaults.adapter = (config) => Promise.reject(new CanceledError('Cancelled', config))
  await assert.rejects(apiClient.get('/cancelled'))
  assert.equal(requestsPending.value, false)
})

test('repeated submissions are ignored immediately and failure allows retry', async () => {
  const action = useAsyncAction()
  const request = deferred()
  let calls = 0
  const first = action.run('save', async () => {
    calls += 1
    await request.promise
  })
  await action.run('save', async () => {
    calls += 1
  })
  assert.equal(calls, 1)
  assert.equal(action.pending.value, true)
  assert.equal(action.activeAction.value, 'save')
  request.reject(new Error('Offline'))
  await first
  assert.equal(action.pending.value, false)
  assert.ok(action.error.value)
  await action.run('save', async () => {
    calls += 1
  })
  assert.equal(calls, 2)
  assert.equal(action.error.value, '')
})

test('older filter responses cannot replace newer data or clear its loading state', async () => {
  const requests = controlledRequests()
  const store = useDriversStore()
  const first = store.fetchList()
  store.officialFilter = 'official'
  const second = store.fetchList()
  await tick()
  requests[0].resolve([{ id: 'old' }])
  await first
  assert.equal(store.loading, true)
  assert.deepEqual(store.drivers, [])
  requests[1].resolve([{ id: 'new', totalDueMinor: 100 }])
  await second
  assert.equal(store.loading, false)
  assert.equal(store.drivers[0].id, 'new')

  const third = store.fetchList()
  const fourth = store.fetchList()
  await tick()
  requests[3].resolve([{ id: 'latest' }])
  await fourth
  requests[2].reject()
  await third
  assert.equal(store.drivers[0].id, 'latest')
  assert.equal(store.error, '')
})

test('failed reload preserves data and does not turn a completed save into a failed save', async () => {
  const requests = controlledRequests()
  const store = useDriversStore()
  const action = useAsyncAction()
  store.drivers = [{ id: 'existing' }]
  let modalOpen = true
  const saving = action.run('save', async () => {
    await store.create({ lastName: 'Тест', firstName: 'Тест', isOfficial: false })
    modalOpen = false
    await store.fetchList()
  })
  await tick()
  requests[0].resolve({ id: 'saved' })
  await tick()
  assert.equal(modalOpen, false)
  assert.equal(action.pending.value, true)
  requests[1].reject()
  await saving
  assert.equal(action.error.value, '')
  assert.ok(store.error)
  assert.equal(store.drivers[0].id, 'existing')
  assert.equal(store.loading, false)
  assert.equal(action.pending.value, false)

  const retry = store.fetchList()
  await tick()
  requests[2].resolve([{ id: 'saved' }])
  await retry
  assert.equal(store.error, '')
  assert.equal(store.drivers[0].id, 'saved')
})

test('busy forms disable their controls and expose saving status', async () => {
  const cases = [
    ['DriverFormModal', {}],
    ['ShiftFormModal', {}],
    ['PaymentFormModal', { defaultPeriod: '2026-10' }],
    ['AccrualFormModal', { initial: null }],
  ]
  for (const [name, props] of cases) {
    const { default: component } = await server.ssrLoadModule(`/src/components/${name}.vue`)
    const html = await renderToString(
      createSSRApp(component, { ...props, open: true, saving: true }),
    )
    assert.match(html, /<fieldset[^>]*disabled/, name)
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled/, name)
    assert.match(html, /aria-busy="true"/, name)
    assert.match(html, /Сохраняем…/, name)
  }
})

test('errors explain timeouts and preserve server validation messages', () => {
  assert.match(getErrorMessage(new AxiosError('timeout', 'ECONNABORTED')), /Обновите данные/)
  assert.match(getErrorMessage(new AxiosError('network', 'ERR_NETWORK')), /Проверьте соединение/)
  const error = new AxiosError('validation', 'ERR_BAD_REQUEST', undefined, undefined, {
    data: { message: ['Проверьте дату'] },
    status: 400,
  })
  assert.equal(getErrorMessage(error), 'Проверьте дату')
})
