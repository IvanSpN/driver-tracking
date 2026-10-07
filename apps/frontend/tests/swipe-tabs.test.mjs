import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ref } from 'vue'
import { createServer } from 'vite'

let server
let useSwipeTabs
let selectedText = false
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element')

// Only the DOM methods used by the recognizer; this is not a browser simulation.
class TouchTarget {
  constructor(selector = '') {
    this.selector = selector
  }

  closest(selectors) {
    return selectors.split(', ').includes(this.selector) ? this : null
  }
}

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
  ;({ useSwipeTabs } = await server.ssrLoadModule('/src/composables/useSwipeTabs.ts'))
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: TouchTarget })
})

beforeEach(() => {
  selectedText = false
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: 390,
      scrollY: 0,
      visualViewport: { scale: 1 },
      getSelection: () => ({ isCollapsed: !selectedText }),
    },
  })
})

after(async () => {
  await server?.close()
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete globalThis.window
  if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement)
  else delete globalThis.Element
})

const point = (x, y = 180, identifier = 1) => ({ clientX: x, clientY: y, identifier })
const event = (touches, changedTouches = touches, timeStamp = 0, target = new TouchTarget()) => ({
  touches,
  changedTouches,
  timeStamp,
  target,
})

function setup(initial = 'payroll') {
  const tab = ref(initial)
  let enabled = true
  const handlers = useSwipeTabs(tab, ['payroll', 'shifts', 'overview'], () => enabled)
  function swipe(from = 240, to = 100, target = new TouchTarget()) {
    handlers.onTouchStart(event([point(from)], undefined, 0, target))
    handlers.onTouchMove(event([point(to)], undefined, 150, target))
    handlers.onTouchEnd(event([], [point(to)], 250, target))
  }
  return { tab, ...handlers, swipe, disable: () => (enabled = false) }
}

test('left advances salary → shifts → overview; right reverses without wrapping', () => {
  const state = setup()
  state.swipe(100, 240)
  assert.equal(state.tab.value, 'payroll')
  state.swipe()
  assert.equal(state.tab.value, 'shifts')
  state.swipe()
  assert.equal(state.tab.value, 'overview')
  state.swipe()
  assert.equal(state.tab.value, 'overview')
  state.swipe(100, 240)
  assert.equal(state.tab.value, 'shifts')
  state.swipe(100, 240)
  assert.equal(state.tab.value, 'payroll')
})

test('center swipes work at supported phone widths and landscape; edges are reserved', () => {
  for (const width of [320, 375, 390, 430, 844]) {
    window.innerWidth = width
    const state = setup('shifts')
    state.swipe(20, 150)
    state.swipe(width - 20, width - 150)
    assert.equal(state.tab.value, 'shifts', `edge gesture at ${width}px`)
    state.swipe(width / 2 + 50, width / 2 - 50)
    assert.equal(state.tab.value, 'overview', `center gesture at ${width}px`)
  }
})

test('taps, short drags, diagonal movements and long presses do not switch tabs', () => {
  for (const [x, y, duration] of [
    [240, 180, 100],
    [210, 180, 250],
    [100, 260, 250],
    [100, 180, 900],
  ]) {
    const state = setup()
    state.onTouchStart(event([point(240)]))
    state.onTouchEnd(event([], [point(x, y)], duration))
    assert.equal(state.tab.value, 'payroll')
  }
})

test('vertical scrolling cannot become a swipe even if the finger later moves sideways', () => {
  const state = setup()
  state.onTouchStart(event([point(240)]))
  state.onTouchMove(event([point(238, 210)]))
  state.onTouchMove(event([point(100, 185)]))
  state.onTouchEnd(event([], [point(100, 185)], 250))
  assert.equal(state.tab.value, 'payroll')

  state.onTouchStart(event([point(240)]))
  window.scrollY = 20
  state.onTouchEnd(event([], [point(100)], 250))
  assert.equal(state.tab.value, 'payroll')
})

test('buttons, links, form controls, dialogs and editable text keep their own touch behavior', () => {
  const state = setup()
  for (const selector of [
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'label',
    'dialog',
    '[role="button"]',
    '[contenteditable]:not([contenteditable="false"])',
  ]) {
    state.swipe(240, 100, new TouchTarget(selector))
    assert.equal(state.tab.value, 'payroll', selector)
  }
})

test('multiple touches, pinch zoom and text selection do not switch tabs', () => {
  const state = setup()
  state.onTouchStart(event([point(240), point(200, 200, 2)]))
  state.onTouchEnd(event([], [point(100)], 250))
  assert.equal(state.tab.value, 'payroll')

  state.onTouchStart(event([point(240)]))
  state.onTouchMove(event([point(180), point(200, 200, 2)]))
  state.onTouchEnd(event([], [point(100)], 250))
  assert.equal(state.tab.value, 'payroll')

  window.visualViewport.scale = 2
  state.swipe()
  assert.equal(state.tab.value, 'payroll')
  window.visualViewport.scale = 1
  selectedText = true
  state.swipe()
  assert.equal(state.tab.value, 'payroll')
})

test('opening a modal or starting a request during a gesture prevents switching', () => {
  const state = setup()
  state.onTouchStart(event([point(240)]))
  state.disable()
  state.onTouchEnd(event([], [point(100)], 250))
  state.swipe()
  assert.equal(state.tab.value, 'payroll')
})

test('canceled gestures and mismatched fingers are ignored; the next gesture still works', () => {
  const state = setup()
  state.onTouchStart(event([point(240)]))
  state.cancelSwipe()
  state.onTouchEnd(event([], [point(100)], 250))
  assert.equal(state.tab.value, 'payroll')

  state.onTouchStart(event([point(240)]))
  state.onTouchEnd(event([], [point(100, 180, 2)], 250))
  assert.equal(state.tab.value, 'payroll')
  state.swipe()
  assert.equal(state.tab.value, 'shifts')
})

test('a gesture switches once, and cannot override a tab changed while touching', () => {
  const state = setup()
  state.swipe()
  state.onTouchEnd(event([], [point(100)], 300))
  assert.equal(state.tab.value, 'shifts')

  state.onTouchStart(event([point(240)]))
  state.tab.value = 'payroll'
  state.onTouchEnd(event([], [point(100)], 250))
  assert.equal(state.tab.value, 'payroll')
})
