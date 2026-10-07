export function menuPosition(
  anchor: { right: number; top: number; bottom: number },
  menu: { width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number },
) {
  const gutter = 12
  const gap = 8
  const leftEdge = viewport.left + gutter
  const topEdge = viewport.top + gutter
  const rightEdge = viewport.left + viewport.width - gutter
  const bottomEdge = viewport.top + viewport.height - gutter
  const below = anchor.bottom + gap
  const top = below + menu.height <= bottomEdge ? below : anchor.top - gap - menu.height

  return {
    left: Math.max(leftEdge, Math.min(anchor.right - menu.width, rightEdge - menu.width)),
    top: Math.max(topEdge, Math.min(top, bottomEdge - menu.height)),
  }
}
