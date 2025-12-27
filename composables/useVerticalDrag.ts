import { ref } from 'vue'

interface UseVerticalDragOptions {
  initialY: number // 初始 Y 位置 (百分比 0-100)
  minY?: number // 最小 Y 位置
  maxY?: number // 最大 Y 位置
}

interface UseVerticalDragReturn {
  y: Ref<number>
  setY: (y: number) => void
  isDragging: Ref<boolean>
  handlers: {
    onPointerDown: (e: PointerEvent) => void
    onPointerMove: (e: PointerEvent) => void
    onPointerUp: (e: PointerEvent) => void
    onPointerCancel: (e: PointerEvent) => void
    style: { touchAction: string }
  }
}

export function useVerticalDrag({
  initialY,
  minY = 0,
  maxY = 100,
}: UseVerticalDragOptions): UseVerticalDragReturn {
  const y = ref(initialY)
  const isDragging = ref(false)
  const startYRef = ref(0)
  const startPosRef = ref(0)
  const activeContainerRef = ref<HTMLElement | null>(null)

  // 找到拖曳元素的容器（往上找第一個有有效高度的 relative/absolute 父元素）
  const findContainer = (element: HTMLElement): HTMLElement | null => {
    let parent = element.parentElement
    while (parent) {
      const rect = parent.getBoundingClientRect()
      const style = window.getComputedStyle(parent)
      // 找一個有有效高度且有 position 的容器
      if (rect.height > 0 && (style.position === 'relative' || style.position === 'absolute')) {
        return parent
      }
      parent = parent.parentElement
    }
    return null
  }

  // 統一處理移動邏輯
  const handleMove = (clientY: number) => {
    const container = activeContainerRef.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    if (rect.height === 0) return

    const deltaY = clientY - startYRef.value
    const deltaPercent = (deltaY / rect.height) * 100
    const newY = Math.max(minY, Math.min(maxY, startPosRef.value + deltaPercent))
    y.value = newY
  }

  // Pointer Events (統一 mouse 和 touch)
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 找到並儲存容器參考
    const container = findContainer(e.currentTarget as HTMLElement)
    if (!container) return

    activeContainerRef.value = container
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    startYRef.value = e.clientY
    startPosRef.value = y.value
    isDragging.value = true
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging.value) return
    e.preventDefault()
    handleMove(e.clientY)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (isDragging.value) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      isDragging.value = false
      activeContainerRef.value = null
    }
  }

  const onPointerCancel = (e: PointerEvent) => {
    if (isDragging.value) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      isDragging.value = false
      activeContainerRef.value = null
    }
  }

  return {
    y,
    setY: (newY: number) => {
      y.value = newY
    },
    isDragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: { touchAction: 'none' }, // 防止觸控滾動
    },
  }
}
