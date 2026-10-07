import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { AxiosError, CanceledError } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, createSSRApp, h, nextTick, reactive, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'

let server
let apiClient
let requestsPending
let useAsyncAction
let useDriversStore
let getErrorMessage
let formatPeriod

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [vue()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
  ;({ apiClient, requestsPending } = await server.ssrLoadModule('/src/api/client.ts'))
  ;({ useAsyncAction } = await server.ssrLoadModule('/src/composables/useAsyncAction.ts'))
  ;({ useDriversStore } = await server.ssrLoadModule('/src/stores/drivers.ts'))
  ;({ getErrorMessage } = await server.ssrLoadModule('/src/utils/errors.ts'))
  ;({ formatPeriod } = await server.ssrLoadModule('/src/utils/period.ts'))
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

test('payroll periods display all Russian month names and retain the year', () => {
  const months = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ]
  for (const year of ['2025', '2026', '2027']) {
    months.forEach((month, index) => {
      const period = `${year}-${String(index + 1).padStart(2, '0')}`
      assert.equal(formatPeriod(period), `${year}-${month}`)
    })
  }
})

test('unexpected payroll period values are displayed unchanged', () => {
  for (const period of ['', '2026-00', '2026-13', '2026-1', '2026-10-01', 'not-a-period']) {
    assert.equal(formatPeriod(period), period)
  }
})

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

test('modal tracks keyboard viewport, blocks closing while saving, and cleans up on navigation', async () => {
  const { default: BaseModal } = await server.ssrLoadModule('/src/components/BaseModal.vue')
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const listeners = { resize: new Set(), scroll: new Set() }
  const viewport = {
    height: 780,
    offsetTop: 0,
    scale: 1,
    addEventListener: (name, callback) => listeners[name].add(callback),
    removeEventListener: (name, callback) => listeners[name].delete(callback),
  }
  const pageStyle = { overflow: 'auto' }
  globalThis.window = { visualViewport: viewport }
  globalThis.document = { documentElement: { style: pageStyle } }
  let element
  let requestClose
  let closes = 0
  // A custom Vue host exercises lifecycle behavior without pretending to render Safari.
  const renderer = createRenderer({
    createElement: () => {
      const style = new Map()
      element = {
        open: false,
        style: { setProperty: (name, value) => style.set(name, value) },
        values: style,
        showModal() {
          this.open = true
        },
        close() {
          this.open = false
        },
      }
      return element
    },
    insert: () => {},
    remove: () => {},
    patchProp: () => {},
    setElementText: () => {},
    createText: () => ({}),
    createComment: () => ({}),
    setText: () => {},
    setComment: () => {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  const Harness = {
    ...BaseModal,
    setup(props, context) {
      const bindings = BaseModal.setup(props, context)
      requestClose = bindings.requestClose
      return () => h('dialog', { ref: bindings.dialog })
    },
  }
  const props = reactive({ open: false, title: 'Тестовая форма', busy: false })
  const app = renderer.createApp({
    setup: () => () =>
      h(Harness, {
        ...props,
        onClose: () => {
          closes += 1
        },
      }),
  })
  app.provide(ssrContextKey, {})
  let mounted = false
  try {
    app.mount({})
    mounted = true
    await nextTick()
    assert.equal(element.open, false)
    props.open = true
    await nextTick()
    assert.equal(element.open, true)
    assert.equal(pageStyle.overflow, 'hidden')
    assert.equal(element.values.get('--modal-viewport-height'), '780px')

    viewport.height = 360
    viewport.offsetTop = 100
    for (const resize of listeners.resize) resize()
    assert.equal(element.values.get('--modal-viewport-height'), '360px')
    assert.equal(element.values.get('--modal-viewport-top'), '100px')
    viewport.scale = 2
    viewport.height = 180
    for (const resize of listeners.resize) resize()
    assert.equal(element.values.get('--modal-viewport-height'), '360px')

    props.busy = true
    await nextTick()
    requestClose()
    assert.equal(closes, 0)
    props.busy = false
    await nextTick()
    requestClose()
    assert.equal(closes, 1)

    props.open = false
    await nextTick()
    assert.equal(element.open, false)
    assert.equal(pageStyle.overflow, 'auto')
    assert.equal(listeners.resize.size + listeners.scroll.size, 0)

    props.open = true
    await nextTick()
    app.unmount()
    mounted = false
    assert.equal(element.open, false)
    assert.equal(pageStyle.overflow, 'auto')
    assert.equal(listeners.resize.size + listeners.scroll.size, 0)
  } finally {
    if (mounted) app.unmount()
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})

test('drivers list has its own accessible scroll area, including loading, empty and error states', async () => {
  const { default: component } = await server.ssrLoadModule('/src/views/DriversView.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/drivers/:id?', name: 'driver-detail', component }],
  })
  await router.push('/drivers')
  for (const state of ['loaded', 'loading', 'empty', 'error']) {
    const pinia = createPinia()
    const store = useDriversStore(pinia)
    store.loading = state === 'loading'
    store.error = state === 'error' ? 'Нет связи' : ''
    store.drivers =
      state === 'loaded' ? [{ id: 'test', lastName: 'Тестовый', isOfficial: true }] : []
    const html = await renderToString(createSSRApp(component).use(pinia).use(router))
    const scrollArea = html.match(
      /<section\b[^>]*class="drivers-scroll"[^>]*>([\s\S]*?)<\/section>/,
    )
    assert.ok(scrollArea, state)
    assert.match(scrollArea[0], /tabindex="0"/)
    assert.match(scrollArea[0], /aria-label="Список водителей"/)
    assert.doesNotMatch(scrollArea[1], /Добавить водителя|Показать уволенных/)
    assert.ok(html.indexOf('class="drivers-toolbar"') < scrollArea.index)
    assert.doesNotMatch(html, /<h1[^>]*>Водители<\/h1>/)
    assert.match(html, /aria-label="Добавить водителя"/)
    assert.match(html, /class="[^"]*filter-actions[^"]*"/)
    if (state === 'loaded') assert.match(scrollArea[1], /Тестовый/)
    if (state === 'loading') assert.match(scrollArea[1], /Загружаем водителей/)
    if (state === 'empty') assert.match(scrollArea[1], /Пока нет водителей/)
    if (state === 'error') assert.match(scrollArea[1], /Повторить загрузку/)
  }
})

test('viewport locking applies only to the drivers list, not the detail or other screens', async () => {
  const { default: layout } = await server.ssrLoadModule('/src/layouts/AppLayout.vue')
  const component = { render: () => h('div', 'Тестовая страница') }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component },
      { path: '/drivers', name: 'drivers', component },
      { path: '/drivers/:id', name: 'driver-detail', component },
      { path: '/settings', name: 'settings', component },
    ],
  })
  for (const path of ['/drivers', '/drivers/test', '/settings', '/']) {
    await router.push(path)
    const html = await renderToString(createSSRApp(layout).use(createPinia()).use(router))
    assert.equal(html.includes('shell-drivers'), path === '/drivers')
    assert.match(html, /Основная навигация/)
    assert.doesNotMatch(html, /Выйти/)
  }
})

test('logout is available from settings instead of the shared navigation', async () => {
  const { default: component } = await server.ssrLoadModule('/src/views/SettingsView.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { render: () => h('div') } },
      { path: '/settings', name: 'settings', component },
    ],
  })
  await router.push('/settings')

  const html = await renderToString(createSSRApp(component).use(createPinia()).use(router))
  assert.match(html, /Аккаунт/)
  assert.match(html, /Выйти/)
  assert.match(html, /class="[^"]*logout-btn[^"]*"/)
})

test('only dismissed drivers offer permanent deletion', async () => {
  const { default: component } = await server.ssrLoadModule('/src/views/DriversView.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/drivers/:id?', name: 'driver-detail', component }],
  })
  await router.push('/drivers')
  for (const dismissed of [false, true]) {
    const pinia = createPinia()
    const app = createSSRApp(component).use(pinia).use(router)
    const store = useDriversStore(pinia)
    store.drivers = [
      {
        id: 'driver-id',
        lastName: 'Тестовый',
        firstName: 'Водитель',
        deletedAt: dismissed ? '2026-10-05' : null,
      },
    ]
    const html = await renderToString(app)
    assert.equal(html.includes('Удалить навсегда'), dismissed)
    assert.equal(html.includes('Восстановить'), dismissed)
  }
})

test('driver detail theme follows the driver status on every tab, even with no records', async () => {
  const { default: component } = await server.ssrLoadModule('/src/views/DriverDetailView.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/drivers', name: 'drivers', component },
      { path: '/drivers/:id', name: 'driver-detail', component },
    ],
  })
  await router.push('/drivers/test-driver')

  for (const isOfficial of [null, true, false]) {
    for (const tab of ['payroll', 'shifts', 'overview']) {
      for (const hasRecords of [false, true]) {
        const Harness = {
          ...component,
          setup(props, context) {
            const bindings = component.setup(props, context)
            bindings.driver.value =
              isOfficial === null
                ? null
                : { id: 'test-driver', firstName: 'Водитель', lastName: 'Тестовый', isOfficial }
            bindings.tab.value = tab
            if (hasRecords) {
              bindings.shifts.value = [
                { id: 'shift', startDate: '2026-10-01', isOfficial: !isOfficial },
              ]
              bindings.periods.value = [
                {
                  period: '2026-10',
                  accruedWhiteMinor: 0,
                  accruedBlackMinor: 0,
                  paidWhiteMinor: 0,
                  paidBlackMinor: 0,
                  dueWhiteMinor: 0,
                  dueBlackMinor: 0,
                  payments: [],
                },
              ]
            }
            return bindings
          },
        }
        const html = await renderToString(createSSRApp(Harness).use(router))
        assert.doesNotMatch(html, /back-link|← Водители/)
        const root = html.match(/^<div\b[^>]*>/)?.[0] ?? ''
        assert.ok(root.includes('driver-detail'))
        assert.equal(root.includes('driver-detail-official'), isOfficial === true)
        assert.equal(root.includes('driver-detail-unofficial'), isOfficial === false)
        if (isOfficial !== null) {
          const contentClass = { payroll: 'payroll', shifts: 'shifts', overview: 'overview' }[tab]
          assert.ok(html.includes(`class="${contentClass}"`))
          // Form dialogs retain their own surface, not the driver's status class.
          for (const dialog of html.match(/<dialog\b[^>]*>/g) ?? []) {
            assert.doesNotMatch(dialog, /driver-detail-(?:unofficial|official)/)
          }
        }
      }
    }
  }
})

test('payment form offers white/black payment and restores the saved selection', async () => {
  const { default: component } = await server.ssrLoadModule('/src/components/PaymentFormModal.vue')
  for (const payment of [
    null,
    {
      period: '2026-10',
      channel: 'BLACK',
      type: 'SALARY',
      amountMinor: 10000,
      paidAt: '2026-10-05',
      method: 'CASH',
      note: null,
    },
  ]) {
    const html = await renderToString(
      createSSRApp(component, {
        open: true,
        defaultPeriod: '2026-10',
        payment,
      }),
    )
    assert.match(html, /Оплата/)
    assert.match(html, /<option[^>]*value="WHITE"[^>]*>Белая<\/option>/)
    assert.match(html, /<option[^>]*value="BLACK"[^>]*>Чёрная<\/option>/)
    const selected = (html.match(/<option\b[^>]*>/g) ?? []).find(
      (option) => /value="(?:WHITE|BLACK)"/.test(option) && /\bselected\b/.test(option),
    )
    assert.ok(selected)
    assert.ok(selected.includes(`value="${payment?.channel ?? 'WHITE'}"`))
    assert.match(html, /Зарплата/)
    assert.match(html, /Сумма, ₽/)
  }
})

test('monthly accrual form displays one amount without white/black fields', async () => {
  const { default: component } = await server.ssrLoadModule('/src/components/AccrualFormModal.vue')
  for (const initial of [null, { period: '2026-10', amountMinor: 123456, note: 'За месяц' }]) {
    const html = await renderToString(createSSRApp(component, { open: true, initial }))
    assert.match(html, /Сумма за месяц, ₽/)
    assert.doesNotMatch(html, /Белая|Чёрная|Черная/)
    const amountInputs = (html.match(/<input\b[^>]*>/g) ?? []).filter((input) =>
      input.includes('type="number"'),
    )
    assert.equal(amountInputs.length, 1)
    assert.match(amountInputs[0], initial ? /value="1234\.56"/ : /value="0"/)
  }
})

test('editing a shift exposes both dates and prevents an invalid range', async () => {
  const { default: component } = await server.ssrLoadModule('/src/components/ShiftFormModal.vue')
  const shift = { startDate: '2026-10-01', endDate: '2026-10-15', note: '' }
  const html = await renderToString(createSSRApp(component, { open: true, shift }))
  const inputs = html.match(/<input\b[^>]*>/g) ?? []
  const startInput = inputs.find((input) => input.includes('max=')) ?? ''
  const endInput = inputs.find((input) => input.includes('min=')) ?? ''
  assert.match(startInput, /value="2026-10-01"/)
  assert.match(startInput, /max="2026-10-15"/)
  assert.match(endInput, /value="2026-10-15"/)
  assert.match(endInput, /min="2026-10-01"/)

  const invalid = await renderToString(
    createSSRApp(component, {
      open: true,
      shift: { ...shift, endDate: '2026-09-30' },
    }),
  )
  assert.match(invalid, /Дата окончания вахты не может быть раньше даты начала/)
  assert.match(invalid, /<button[^>]*type="submit"[^>]*disabled/)
})
