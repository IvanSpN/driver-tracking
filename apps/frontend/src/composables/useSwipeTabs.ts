import type { Ref } from 'vue'

const EDGE_GUTTER = 32
const MIN_DISTANCE = 60
const MAX_VERTICAL_DISTANCE = 40
const MAX_DURATION = 700
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, dialog, [role="button"], [contenteditable]:not([contenteditable="false"])'

export function useSwipeTabs<T extends string>(
  activeTab: Ref<T>,
  tabs: readonly T[],
  isEnabled: () => boolean,
) {
  let gesture: {
    id: number
    x: number
    y: number
    scrollY: number
    startedAt: number
    tab: T
  } | null = null

  function cancelSwipe() {
    gesture = null
  }

  function canSwipe() {
    return (
      isEnabled() &&
      (window.visualViewport?.scale ?? 1) === 1 &&
      window.getSelection()?.isCollapsed !== false
    )
  }

  function onTouchStart(event: TouchEvent) {
    cancelSwipe()
    if (!canSwipe() || event.touches.length !== 1) return
    if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE_SELECTOR)) return

    const touch = event.touches[0]
    // Leave both screen edges to the browser's back/forward gestures.
    if (
      !touch ||
      touch.clientX <= EDGE_GUTTER ||
      touch.clientX >= window.innerWidth - EDGE_GUTTER
    ) {
      return
    }

    gesture = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      scrollY: window.scrollY,
      startedAt: event.timeStamp,
      tab: activeTab.value,
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (!gesture) return
    const touch = event.touches[0]
    if (!canSwipe() || event.touches.length !== 1 || !touch || touch.identifier !== gesture.id) {
      cancelSwipe()
      return
    }

    const dx = Math.abs(touch.clientX - gesture.x)
    const dy = Math.abs(touch.clientY - gesture.y)
    // Once scrolling starts, a later horizontal movement must not change tabs.
    if (
      (dy >= 12 && dx < dy * 1.5) ||
      dy > MAX_VERTICAL_DISTANCE ||
      Math.abs(window.scrollY - gesture.scrollY) > 8
    ) {
      cancelSwipe()
    }
  }

  function onTouchEnd(event: TouchEvent) {
    const start = gesture
    cancelSwipe()
    if (!start || !canSwipe() || event.touches.length !== 0 || activeTab.value !== start.tab) return

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id)
    if (!touch) return

    const dx = touch.clientX - start.x
    const dy = Math.abs(touch.clientY - start.y)
    if (
      event.timeStamp - start.startedAt > MAX_DURATION ||
      Math.abs(dx) < MIN_DISTANCE ||
      Math.abs(dx) < dy * 1.5 ||
      dy > MAX_VERTICAL_DISTANCE ||
      Math.abs(window.scrollY - start.scrollY) > 8
    ) {
      return
    }

    const index = tabs.indexOf(start.tab)
    const nextTab = tabs[index + (dx < 0 ? 1 : -1)]
    if (index !== -1 && nextTab !== undefined) activeTab.value = nextTab
  }

  // Bind these as passive handlers: scrolling and pinch-to-zoom remain native.
  return { onTouchStart, onTouchMove, onTouchEnd, cancelSwipe }
}
