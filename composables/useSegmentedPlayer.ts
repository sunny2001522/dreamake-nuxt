/**
 * Segmented Video Player Composable
 * 使用雙 Video 元素切換策略實現無縫串接播放
 */

import type { GeneratedSegment } from '~/types'

export interface SegmentedPlayerOptions {
  /** 分段變更回調 */
  onSegmentChange?: (segment: GeneratedSegment) => void
  /** 時間更新回調 */
  onTimeUpdate?: (globalTime: number, localTime: number) => void
  /** 播放結束回調 */
  onEnded?: () => void
  /** 提前預載的秒數 (預設 0.5) */
  preloadThreshold?: number
}

export function useSegmentedPlayer(options: SegmentedPlayerOptions = {}) {
  const { preloadThreshold = 0.5 } = options

  const store = useSegmentedGenerationStore()

  // ============================================
  // State
  // ============================================

  /** 雙緩衝 Video 元素 */
  const videoA = ref<HTMLVideoElement | null>(null)
  const videoB = ref<HTMLVideoElement | null>(null)

  /** 當前活躍的 video ('A' | 'B') */
  const activeVideo = ref<'A' | 'B'>('A')

  /** 播放狀態 */
  const isPlaying = ref(false)
  const isSeeking = ref(false)
  const isLoading = ref(false)

  /** 當前播放的分段索引 */
  const currentSegmentIndex = ref(0)

  /** 預載的分段索引 */
  const preloadedIndex = ref(-1)

  /** 是否已初始化 */
  const isInitialized = ref(false)

  // ============================================
  // Computed
  // ============================================

  /** 取得當前活躍的 video 元素 */
  const currentVideo = computed(() =>
    activeVideo.value === 'A' ? videoA.value : videoB.value
  )

  /** 取得待命的 video 元素 */
  const standbyVideo = computed(() =>
    activeVideo.value === 'A' ? videoB.value : videoA.value
  )

  // ============================================
  // Methods
  // ============================================

  /**
   * 初始化播放器
   */
  function initialize(videoElA: HTMLVideoElement, videoElB: HTMLVideoElement) {
    videoA.value = videoElA
    videoB.value = videoElB

    // 設定 video 樣式 (疊加在一起)
    const setupVideo = (el: HTMLVideoElement) => {
      el.style.position = 'absolute'
      el.style.top = '0'
      el.style.left = '0'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.objectFit = 'cover'
      el.playsInline = true
      el.preload = 'auto'
    }

    setupVideo(videoElA)
    setupVideo(videoElB)

    // 初始隱藏 B
    videoElB.style.opacity = '0'
    videoElB.style.pointerEvents = 'none'

    // 綁定事件
    videoElA.addEventListener('timeupdate', handleTimeUpdate)
    videoElB.addEventListener('timeupdate', handleTimeUpdate)
    videoElA.addEventListener('ended', handleVideoEnded)
    videoElB.addEventListener('ended', handleVideoEnded)

    isInitialized.value = true

    // 如果有已完成的分段，載入第一段
    if (store.completedSegments.length > 0) {
      loadSegment(0, videoElA)
    }
  }

  /**
   * 載入指定分段到 video 元素
   */
  async function loadSegment(index: number, video: HTMLVideoElement): Promise<boolean> {
    const segments = store.completedSegments
    if (index < 0 || index >= segments.length) return false

    const segment = segments[index]
    if (!segment.videoUrl) return false

    isLoading.value = true

    return new Promise((resolve) => {
      const onCanPlay = () => {
        video.removeEventListener('canplaythrough', onCanPlay)
        video.removeEventListener('error', onError)
        isLoading.value = false
        resolve(true)
      }

      const onError = () => {
        video.removeEventListener('canplaythrough', onCanPlay)
        video.removeEventListener('error', onError)
        isLoading.value = false
        console.error(`Failed to load segment ${index}`)
        resolve(false)
      }

      video.addEventListener('canplaythrough', onCanPlay)
      video.addEventListener('error', onError)

      video.src = segment.videoUrl!
      video.load()
    })
  }

  /**
   * 預載下一段
   */
  async function preloadNext() {
    const nextIndex = currentSegmentIndex.value + 1
    if (nextIndex >= store.completedSegments.length) return
    if (preloadedIndex.value === nextIndex) return // 已預載

    const video = standbyVideo.value
    if (!video) return

    const success = await loadSegment(nextIndex, video)
    if (success) {
      preloadedIndex.value = nextIndex
      console.log(`[Player] Preloaded segment ${nextIndex}`)
    }
  }

  /**
   * 切換到下一段
   */
  async function switchToNext() {
    const nextIndex = currentSegmentIndex.value + 1
    if (nextIndex >= store.completedSegments.length) {
      // 播放結束
      isPlaying.value = false
      store.setPlaying(false)
      options.onEnded?.()
      return
    }

    const current = currentVideo.value
    const next = standbyVideo.value
    if (!current || !next) return

    // 確保下一段已預載
    if (preloadedIndex.value !== nextIndex) {
      await loadSegment(nextIndex, next)
    }

    const segment = store.completedSegments[nextIndex]

    // 切換顯示
    current.style.opacity = '0'
    current.style.pointerEvents = 'none'
    next.style.opacity = '1'
    next.style.pointerEvents = 'auto'

    // 開始播放新段落
    next.currentTime = 0
    if (isPlaying.value) {
      await next.play()
    }

    // 暫停舊段落
    current.pause()

    // 切換活躍 video
    activeVideo.value = activeVideo.value === 'A' ? 'B' : 'A'
    currentSegmentIndex.value = nextIndex
    store.seekToSegment(nextIndex)

    // 通知分段變更
    options.onSegmentChange?.(segment)

    // 開始預載下下一段
    preloadNext()
  }

  /**
   * 處理 timeupdate 事件
   */
  function handleTimeUpdate() {
    const video = currentVideo.value
    if (!video || isSeeking.value) return

    const segment = store.completedSegments[currentSegmentIndex.value]
    if (!segment) return

    const localTime = video.currentTime
    const globalTime = (segment.globalStartTime || 0) + localTime
    const duration = segment.audioDuration || video.duration

    // 更新 store 的全域時間
    store.setGlobalTime(globalTime)

    // 通知時間更新
    options.onTimeUpdate?.(globalTime, localTime)

    // 檢查是否需要預載下一段
    if (duration - localTime < preloadThreshold * 2) {
      preloadNext()
    }

    // 檢查是否需要切換到下一段
    if (duration - localTime < 0.05) {
      switchToNext()
    }
  }

  /**
   * 處理影片結束事件
   */
  function handleVideoEnded() {
    // 切換到下一段或結束
    switchToNext()
  }

  /**
   * 播放
   */
  async function play() {
    const video = currentVideo.value
    if (!video) return

    // 如果沒有載入，先載入第一段
    if (!video.src && store.completedSegments.length > 0) {
      await loadSegment(0, video)
    }

    try {
      await video.play()
      isPlaying.value = true
      store.setPlaying(true)
    } catch (error) {
      console.error('Play failed:', error)
      // 嘗試靜音播放
      video.muted = true
      await video.play()
      isPlaying.value = true
      store.setPlaying(true)
    }
  }

  /**
   * 暫停
   */
  function pause() {
    const video = currentVideo.value
    if (!video) return

    video.pause()
    isPlaying.value = false
    store.setPlaying(false)
  }

  /**
   * 切換播放/暫停
   */
  function togglePlay() {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * 跳轉到指定全域時間
   */
  async function seekTo(globalTime: number) {
    isSeeking.value = true

    // 找到對應的分段
    const segments = store.completedSegments
    let targetIndex = 0
    let localTime = globalTime

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const start = seg.globalStartTime || 0
      const end = seg.globalEndTime || 0

      if (globalTime >= start && globalTime < end) {
        targetIndex = i
        localTime = globalTime - start
        break
      }
    }

    // 如果需要切換分段
    if (targetIndex !== currentSegmentIndex.value) {
      const video = currentVideo.value
      if (video) {
        await loadSegment(targetIndex, video)
        currentSegmentIndex.value = targetIndex
      }
    }

    // 設定本地時間
    const video = currentVideo.value
    if (video) {
      video.currentTime = localTime
    }

    store.setGlobalTime(globalTime)
    isSeeking.value = false

    // 預載下一段
    preloadNext()
  }

  /**
   * 跳轉到指定分段
   */
  async function seekToSegment(index: number) {
    const segment = store.completedSegments[index]
    if (segment) {
      await seekTo(segment.globalStartTime || 0)
    }
  }

  /**
   * 重新載入當前分段（用於重新生成後）
   */
  async function reloadCurrentSegment() {
    const video = currentVideo.value
    if (!video) return

    const wasPlaying = isPlaying.value
    if (wasPlaying) {
      pause()
    }

    await loadSegment(currentSegmentIndex.value, video)

    if (wasPlaying) {
      await play()
    }
  }

  /**
   * 清理
   */
  function cleanup() {
    pause()

    // 移除事件監聽
    if (videoA.value) {
      videoA.value.removeEventListener('timeupdate', handleTimeUpdate)
      videoA.value.removeEventListener('ended', handleVideoEnded)
    }
    if (videoB.value) {
      videoB.value.removeEventListener('timeupdate', handleTimeUpdate)
      videoB.value.removeEventListener('ended', handleVideoEnded)
    }

    videoA.value = null
    videoB.value = null
    preloadedIndex.value = -1
    currentSegmentIndex.value = 0
    isInitialized.value = false
  }

  // 監聽 completedSegments 變化，自動載入第一段
  watch(
    () => store.completedSegments,
    (newSegments) => {
      if (isInitialized.value && newSegments.length > 0 && currentSegmentIndex.value === 0) {
        const video = currentVideo.value
        if (video && !video.src) {
          loadSegment(0, video)
        }
      }
    },
    { deep: true }
  )

  return {
    // State
    isPlaying: readonly(isPlaying),
    isSeeking: readonly(isSeeking),
    isLoading: readonly(isLoading),
    isInitialized: readonly(isInitialized),
    currentSegmentIndex: readonly(currentSegmentIndex),
    activeVideo: readonly(activeVideo),

    // Methods
    initialize,
    play,
    pause,
    togglePlay,
    seekTo,
    seekToSegment,
    reloadCurrentSegment,
    cleanup,
  }
}
