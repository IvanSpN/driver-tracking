import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPinia } from 'pinia'
import { createRenderer, createSSRApp, h, nextTick, reactive, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

let server
let DriverActionsMenu
let DriversView
let useDriversStore
let menuPosition

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [vue()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
  ;({ default: DriverActionsMenu } = await server.ssrLoadModule(
    '/src/components/DriverActionsMenu.vue',
  ))
  ;({ default: DriversView } = await server.ssrLoadModule('/src/views/DriversView.vue'))
  ;({ useDriversStore } = await server.ssrLoadModule('/src/stores/drivers.ts'))
  ;({ menuPosition } = await server.ssrLoadModule('/src/utils/menuPosition.ts'))
})

after(async () => {
  await server?.close()
})

test('menu fits phone widths and flips above cards near the viewport bottom', () => {
  for (const width of [320, 375, 390, 430, 844]) {
    const viewport = { left: 0, top: 0, width, height: 568 }
    const menu = { width: 240, height: 132 }
    const upper = menuPosition({ right: width - 32, top: 120, bottom: 168 }, menu, viewport)
    const lower = menuPosition({ right: width - 32, top: 488, bottom: 536 }, menu, viewport)
    assert.equal(upper.top, 176)
    assert.equal(lower.top, 348)
    for (const position of [upper, lower]) {
      assert.ok(position.left >= 12)
      assert.ok(position.left + menu.width <= width - 12)
      assert.ok(position.top + menu.height <= viewport.height - 12)
    }
  }
})

test('menu clamps to a reduced visual viewport and handles enlarged content', () => {
  const viewport = { left: 40, top: 100, width: 280, height: 200 }
  const menu = { width: 256, height: 176 }
  const position = menuPosition({ right: 360, top: 270, bottom: 318 }, menu, viewport)
  assert.deepEqual(position, { left: 52, top: 112 })
})

test('menu is closed initially, names its driver and separates the dismissal action', async () => {
  const html = await renderToString(createSSRApp(DriverActionsMenu, { driverName: 'Иванов Иван' }))
  assert.match(html, /aria-label="Действия: Иванов Иван"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.doesNotMatch(html, /<dialog[^>]*\sopen(?:\s|>)/)
  assert.ok(html.indexOf('Редактировать') < html.indexOf('role="separator"'))
  assert.ok(html.indexOf('role="separator"') < html.indexOf('Уволить'))
  assert.match(html, /menu-item-danger/)

  const busy = await renderToString(
    createSSRApp(DriverActionsMenu, { driverName: 'Иванов Иван', loading: true }),
  )
  assert.match(busy, /<button[^>]*aria-busy="true"[^>]*disabled/)
})

test('menu closes before emitting an action, ignores duplicate picks and cleans up listeners', async () => {
  const previousWindow = globalThis.window
  const listeners = new Map()
  const viewportListeners = new Map()
  function events(map) {
    return {
      addEventListener(type, fn) {
        if (!map.has(type)) map.set(type, new Set())
        map.get(type).add(fn)
      },
      removeEventListener(type, fn) {
        map.get(type)?.delete(fn)
      },
    }
  }
  globalThis.window = {
    innerWidth: 390,
    innerHeight: 700,
    ...events(listeners),
    visualViewport: {
      width: 390,
      height: 700,
      offsetLeft: 0,
      offsetTop: 0,
      ...events(viewportListeners),
    },
  }
  const elements = {}
  let firstItemFocused = 0
  let bindings
  const actions = []
  // Exercise component state/lifecycle without claiming to emulate Safari's top layer.
  const renderer = createRenderer({
    createElement(tag) {
      const element = {
        style: {},
        open: false,
        showModal() {
          this.open = true
        },
        close() {
          this.open = false
        },
        getBoundingClientRect: () =>
          tag === 'dialog' ? { width: 240, height: 132 } : { right: 358, top: 480, bottom: 528 },
        querySelector: () => ({
          focus: () => {
            firstItemFocused += 1
          },
        }),
      }
      elements[tag] = element
      return element
    },
    insert() {},
    remove() {},
    patchProp() {},
    setElementText() {},
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setComment() {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  const Harness = {
    ...DriverActionsMenu,
    setup(props, context) {
      bindings = DriverActionsMenu.setup(props, context)
      return () =>
        h('div', [h('button', { ref: bindings.trigger }), h('dialog', { ref: bindings.dialog })])
    },
  }
  const props = reactive({ driverName: 'Иванов Иван', disabled: false, loading: false })
  const app = renderer.createApp({
    setup: () => () =>
      h(Harness, {
        ...props,
        onEdit: () => {
          assert.equal(elements.dialog.open, false)
          actions.push('edit')
        },
        onDismiss: () => {
          assert.equal(elements.dialog.open, false)
          actions.push('dismiss')
        },
      }),
  })
  app.provide(ssrContextKey, {})
  let mounted = false
  try {
    app.mount({})
    mounted = true
    bindings.choose('dismiss')
    assert.deepEqual(actions, [])
    bindings.openMenu()
    assert.equal(elements.dialog.open, true)
    assert.equal(bindings.opened.value, true)
    assert.equal(firstItemFocused, 1)
    assert.equal(elements.dialog.style.left, '118px')
    bindings.choose('edit')
    bindings.choose('dismiss')
    assert.deepEqual(actions, ['edit'])

    bindings.openMenu()
    bindings.choose('dismiss')
    assert.deepEqual(actions, ['edit', 'dismiss'])
    bindings.openMenu()
    props.disabled = true
    await nextTick()
    assert.equal(elements.dialog.open, false)
    bindings.openMenu()
    assert.equal(elements.dialog.open, false)
    props.disabled = false
    await nextTick()
    bindings.openMenu()
    for (const resize of listeners.get('resize')) resize()
    assert.equal(elements.dialog.open, false)
    bindings.openMenu()
    for (const scroll of listeners.get('scroll')) scroll({ target: {} })
    assert.equal(elements.dialog.open, false)
    bindings.openMenu()
    app.unmount()
    mounted = false
    assert.equal(elements.dialog.open, false)
    for (const map of [listeners, viewportListeners]) {
      for (const set of map.values()) assert.equal(set.size, 0)
    }
  } finally {
    if (mounted) app.unmount()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('dismissal requires confirmation with the full name and cannot submit twice', async () => {
  const driver = {
    id: 'driver-id',
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    isOfficial: false,
  }
  const pinia = createPinia()
  const store = useDriversStore(pinia)
  store.drivers = [driver]
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/drivers/:id?', name: 'driver-detail', component: DriversView }],
  })
  await router.push('/drivers')
  let bindings
  const Harness = {
    ...DriversView,
    setup(props, context) {
      bindings = DriversView.setup(props, context)
      return bindings
    },
  }
  const html = await renderToString(createSSRApp(Harness).use(pinia).use(router))
  assert.match(html, /menu-trigger/)
  assert.doesNotMatch(html, /class="driver-actions"/)

  const previousConfirm = globalThis.confirm
  const confirmations = []
  const removed = []
  const pending = Promise.withResolvers()
  let accepted = false
  store.remove = async (id) => {
    removed.push(id)
    await pending.promise
  }
  store.fetchList = async () => {}
  globalThis.confirm = (message) => {
    confirmations.push(message)
    return accepted
  }
  try {
    await bindings.handleRemove(driver)
    assert.deepEqual(removed, [])
    assert.match(confirmations[0], /Иванов Иван Иванович/)
    accepted = true
    const removal = bindings.handleRemove(driver)
    await bindings.handleRemove(driver)
    assert.deepEqual(removed, ['driver-id'])
    assert.equal(confirmations.length, 2)
    pending.resolve()
    await removal
    await bindings.handleRemove({ ...driver, deletedAt: '2026-10-01' })
    assert.equal(confirmations.length, 2)
    bindings.openEdit(driver)
    assert.equal(bindings.editingDriver.value.id, driver.id)
    assert.equal(bindings.modalOpen.value, true)
  } finally {
    pending.resolve()
    if (previousConfirm === undefined) delete globalThis.confirm
    else globalThis.confirm = previousConfirm
  }
})
