import { ref, computed } from 'vue'

interface UseImagePanZoomOptions {
  initialPanX?: number // 初始 X 偏移（-1 ~ 1），預設 0
  initialPanY?: number // 初始 Y 偏移（-1 ~ 1），預設 0
}

interface UseImagePanZoomReturn {
  panX: Ref<number>
  panY: Ref<number>
  isPanning: Ref<boolean>
  handlers: {
    onPointerDown: (e: PointerEvent) => void
    onPointerMove: (e: PointerEvent) => void
    onPointerUp: (e: PointerEvent) => void
    onPointerCancel: (e: PointerEvent) => void
    onTouchStart: (e: TouchEvent) => void
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
    style: { touchAction: string }
  }
  objectPosition: ComputedRef<string>
  reset: () => void
  setValues: (values: { panX?: number; panY?: number }) => void
}

export function useImagePanZoom(options: UseImagePanZoomOptions = {}): UseImagePanZoomReturn {
  const {
    initialPanX = 0,
    initialPanY = 0,
  } = options

  const panX = ref(initialPanX)
  const panY = ref(initialPanY)
  const isPanning = ref(false)

  // 拖曳狀態
  const startPointerX = ref(0)
  const startPointerY = ref(0)
  const startPanX = ref(0)
  const startPanY = ref(0)
  const containerRef = ref<HTMLElement | null>(null)

  // 限制平移值在 -1 ~ 1 之間
  const clampPan = (value: number): number => {
    return Math.max(-1, Math.min(1, value))
  }

  // 找到拖曳元素的容器
  const findContainer = (element: HTMLElement): HTMLElement | null => {
    let parent = element.parentElement
    while (parent) {
      const rect = parent.getBoundingClientRect()
      const style = window.getComputedStyle(parent)
      if (rect.height > 0 && (style.position === 'relative' || style.position === 'absolute' || style.overflow === 'hidden')) {
        return parent
      }
      parent = parent.parentElement
    }
    return element.parentElement
  }

  // Pointer Events - 平移（桌面滑鼠）
  const onPointerDown = (e: PointerEvent) => {
    // 觸控用 TouchEvent 處理
    if (e.pointerType === 'touch') return

    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    containerRef.value = findContainer(target)
    isPanning.value = true
    startPointerX.value = e.clientX
    startPointerY.value = e.clientY
    startPanX.value = panX.value
    startPanY.value = panY.value
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isPanning.value || e.pointerType === 'touch') return
    e.preventDefault()

    const container = containerRef.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    // 計算移動的比例（相對於容器尺寸）
    // 移動容器寬度的距離 = panX 改變 2（從 -1 到 1）
    const deltaX = (e.clientX - startPointerX.value) / rect.width * 2
    const deltaY = (e.clientY - startPointerY.value) / rect.height * 2

    panX.value = clampPan(startPanX.value + deltaX)
    panY.value = clampPan(startPanY.value + deltaY)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (isPanning.value && e.pointerType !== 'touch') {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      isPanning.value = false
      containerRef.value = null
    }
  }

  const onPointerCancel = (e: PointerEvent) => {
    if (isPanning.value && e.pointerType !== 'touch') {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      isPanning.value = false
      containerRef.value = null
    }
  }

  // 觸控事件 - 單指平移
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault()
      isPanning.value = true

      const target = e.currentTarget as HTMLElement
      containerRef.value = findContainer(target)
      startPointerX.value = e.touches[0].clientX
      startPointerY.value = e.touches[0].clientY
      startPanX.value = panX.value
      startPanY.value = panY.value
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && isPanning.value) {
      e.preventDefault()

      const container = containerRef.value
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const deltaX = (e.touches[0].clientX - startPointerX.value) / rect.width * 2
      const deltaY = (e.touches[0].clientY - startPointerY.value) / rect.height * 2

      panX.value = clampPan(startPanX.value + deltaX)
      panY.value = clampPan(startPanY.value + deltaY)
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      isPanning.value = false
      containerRef.value = null
    }
  }

  // object-position CSS 值
  // panX/panY: -1 ~ 1 → 0% ~ 100%
  const objectPosition = computed(() => {
    const x = (panX.value + 1) * 50  // -1 → 0%, 0 → 50%, 1 → 100%
    const y = (panY.value + 1) * 50
    return `${x}% ${y}%`
  })

  // 重置
  const reset = () => {
    panX.value = 0
    panY.value = 0
  }

  // 設置值（用於同步 store）
  const setValues = (values: { panX?: number; panY?: number }) => {
    if (values.panX !== undefined) panX.value = values.panX
    if (values.panY !== undefined) panY.value = values.panY
  }

  return {
    panX,
    panY,
    isPanning,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      style: { touchAction: 'none' }, // 防止觸控滾動
    },
    objectPosition,
    reset,
    setValues,
  }
}
