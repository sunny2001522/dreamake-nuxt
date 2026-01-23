/**
 * Segmented Video Generation Store
 * 分段生成影片的狀態管理
 */

import type {
  GeneratedSegment,
  SegmentedJobStatus,
  SegmentedJobProgressResponse,
  SegmentedGenerationResponse,
  RegenerateType,
  TimelineTracks,
  TimelineTrackItem,
} from '~/types'

export const useSegmentedGenerationStore = defineStore('segmentedGeneration', () => {
  // ============================================
  // State
  // ============================================

  /** 當前任務 ID */
  const jobId = ref<string | null>(null)

  /** 所有分段 */
  const segments = ref<GeneratedSegment[]>([])

  /** 整體狀態 */
  const overallStatus = ref<SegmentedJobStatus | 'idle'>('idle')

  /** 進度統計 */
  const progress = ref({
    total: 0,
    completed: 0,
    failed: 0,
    processing: 0,
  })

  /** 總時長 (秒) */
  const totalDuration = ref(0)

  /** Polling 相關 */
  const isPolling = ref(false)
  let pollingTimer: ReturnType<typeof setTimeout> | null = null
  const POLL_INTERVAL = 3000

  // ============================================
  // 播放相關狀態
  // ============================================

  /** 當前播放的分段索引 */
  const currentPlayingIndex = ref(0)

  /** 全域播放時間 (秒) */
  const globalCurrentTime = ref(0)

  /** 是否正在播放 */
  const isPlaying = ref(false)

  // ============================================
  // Computed
  // ============================================

  /** 是否正在生成中 */
  const isGenerating = computed(() =>
    overallStatus.value === 'segmenting' || overallStatus.value === 'generating'
  )

  /** 整體進度百分比 (0-100) */
  const overallProgress = computed(() => {
    if (progress.value.total === 0) return 0
    return Math.round((progress.value.completed / progress.value.total) * 100)
  })

  /** 已完成的分段 (按索引排序) */
  const completedSegments = computed(() =>
    segments.value
      .filter(s => s.status === 'completed')
      .sort((a, b) => a.index - b.index)
  )

  /** 當前應該播放的分段 */
  const currentSegment = computed(() => {
    if (completedSegments.value.length === 0) return null

    for (const seg of completedSegments.value) {
      if (
        globalCurrentTime.value >= (seg.globalStartTime || 0) &&
        globalCurrentTime.value < (seg.globalEndTime || 0)
      ) {
        return seg
      }
    }

    // 如果時間超出範圍，返回最後一個
    return completedSegments.value[completedSegments.value.length - 1]
  })

  /** 當前分段內的本地時間 */
  const localCurrentTime = computed(() => {
    if (!currentSegment.value) return 0
    return globalCurrentTime.value - (currentSegment.value.globalStartTime || 0)
  })

  /** 當前應顯示的字幕 */
  const currentSubtitle = computed(() => {
    const seg = currentSegment.value
    if (!seg?.subtitles) return ''

    const subtitle = seg.subtitles.find(
      sub => localCurrentTime.value >= sub.startTime && localCurrentTime.value < sub.endTime
    )
    return subtitle?.text || ''
  })

  /** 時間軸軌道資料 */
  const timelineTracks = computed<TimelineTracks>(() => {
    const videoTrack: TimelineTrackItem[] = []
    const audioTrack: TimelineTrackItem[] = []
    const subtitleTrack: TimelineTrackItem[] = []

    for (const seg of completedSegments.value) {
      const start = seg.globalStartTime || 0
      const end = seg.globalEndTime || start

      // 影片軌
      if (seg.videoUrl) {
        videoTrack.push({
          segmentId: seg.id,
          segmentIndex: seg.index,
          startTime: start,
          endTime: end,
          content: seg.videoUrl,
        })
      }

      // 音頻軌
      if (seg.audioUrl) {
        audioTrack.push({
          segmentId: seg.id,
          segmentIndex: seg.index,
          startTime: start,
          endTime: end,
          content: seg.audioUrl,
        })
      }

      // 字幕軌 (每個字幕片段)
      if (seg.subtitles) {
        for (const sub of seg.subtitles) {
          subtitleTrack.push({
            segmentId: seg.id,
            segmentIndex: seg.index,
            startTime: start + sub.startTime,
            endTime: start + sub.endTime,
            content: sub.text,
          })
        }
      }
    }

    return { video: videoTrack, audio: audioTrack, subtitle: subtitleTrack }
  })

  // ============================================
  // Actions
  // ============================================

  /**
   * 開始分段生成
   */
  async function startSegmentedGeneration(params: {
    transcript: string
    speakerId: string
    avatarUrl: string
    aspectRatio: string
    videoModel?: string
    waveSpeedPrompt?: string
    waveSpeedResolution?: string
    userId?: string
    avatarRotation?: number
    avatarPanX?: number
    avatarPanY?: number
    avatarScale?: number
  }): Promise<SegmentedGenerationResponse> {
    // 重置狀態
    reset()
    overallStatus.value = 'segmenting'

    try {
      const response = await $fetch<SegmentedGenerationResponse>('/api/generate/segmented', {
        method: 'POST',
        body: params,
      })

      jobId.value = response.jobId
      segments.value = response.segments
      progress.value.total = response.totalSegments
      overallStatus.value = 'generating'

      // 開始 polling
      startPolling()

      return response
    } catch (error: any) {
      overallStatus.value = 'failed'
      throw error
    }
  }

  /**
   * 開始輪詢進度
   */
  function startPolling() {
    if (isPolling.value) return

    isPolling.value = true
    pollProgress()
  }

  /**
   * 停止輪詢
   */
  function stopPolling() {
    isPolling.value = false
    if (pollingTimer) {
      clearTimeout(pollingTimer)
      pollingTimer = null
    }
  }

  /**
   * 輪詢進度
   */
  async function pollProgress() {
    if (!isPolling.value || !jobId.value) return

    try {
      const response = await $fetch<SegmentedJobProgressResponse>(
        `/api/generate/segmented/${jobId.value}`
      )

      // 更新狀態
      overallStatus.value = response.status
      progress.value = response.progress
      segments.value = response.segments

      if (response.totalDuration) {
        totalDuration.value = response.totalDuration
      }

      // 重新計算全域時間軸
      recalculateGlobalTimes()

      // 如果完成或失敗，停止 polling
      if (response.status === 'completed' || response.status === 'failed') {
        stopPolling()
      } else {
        // 繼續 polling
        pollingTimer = setTimeout(pollProgress, POLL_INTERVAL)
      }
    } catch (error) {
      console.error('Polling error:', error)
      // 發生錯誤時繼續 polling
      pollingTimer = setTimeout(pollProgress, POLL_INTERVAL)
    }
  }

  /**
   * 重新生成單一分段
   */
  async function regenerateSegment(segmentIndex: number, type: RegenerateType): Promise<void> {
    if (!jobId.value) {
      throw new Error('No active job')
    }

    // 更新本地狀態
    const segment = segments.value.find(s => s.index === segmentIndex)
    if (segment) {
      segment.status = type === 'video' ? 'video' : 'tts'
      segment.error = undefined
    }

    try {
      const response = await $fetch<{ success: boolean; segment: GeneratedSegment }>(
        `/api/generate/segmented/${jobId.value}/regenerate`,
        {
          method: 'POST',
          body: { segmentIndex, type },
        }
      )

      // 更新本地分段
      const idx = segments.value.findIndex(s => s.index === segmentIndex)
      if (idx !== -1) {
        segments.value[idx] = response.segment
      }

      // 重新開始 polling
      if (!isPolling.value) {
        overallStatus.value = 'generating'
        startPolling()
      }
    } catch (error: any) {
      // 更新錯誤狀態
      if (segment) {
        segment.status = 'failed'
        segment.error = error.message || 'Regeneration failed'
      }
      throw error
    }
  }

  /**
   * 重新計算全域時間軸
   */
  function recalculateGlobalTimes() {
    let accumulated = 0

    for (const seg of segments.value) {
      if (seg.status === 'completed' && seg.audioDuration) {
        seg.globalStartTime = accumulated
        accumulated += seg.audioDuration
        seg.globalEndTime = accumulated
      }
    }

    totalDuration.value = accumulated
  }

  /**
   * 設定全域播放時間
   */
  function setGlobalTime(time: number) {
    globalCurrentTime.value = time

    // 更新當前播放索引
    for (const seg of completedSegments.value) {
      if (time >= (seg.globalStartTime || 0) && time < (seg.globalEndTime || 0)) {
        currentPlayingIndex.value = seg.index
        break
      }
    }
  }

  /**
   * 設定播放狀態
   */
  function setPlaying(playing: boolean) {
    isPlaying.value = playing
  }

  /**
   * 跳轉到指定分段
   */
  function seekToSegment(index: number) {
    const seg = completedSegments.value.find(s => s.index === index)
    if (seg) {
      globalCurrentTime.value = seg.globalStartTime || 0
      currentPlayingIndex.value = index
    }
  }

  /**
   * 載入現有任務
   */
  async function loadJob(existingJobId: string): Promise<void> {
    reset()
    jobId.value = existingJobId

    try {
      const response = await $fetch<SegmentedJobProgressResponse>(
        `/api/generate/segmented/${existingJobId}`
      )

      overallStatus.value = response.status
      progress.value = response.progress
      segments.value = response.segments

      if (response.totalDuration) {
        totalDuration.value = response.totalDuration
      }

      recalculateGlobalTimes()

      // 如果還在進行中，開始 polling
      if (response.status === 'generating' || response.status === 'segmenting') {
        startPolling()
      }
    } catch (error: any) {
      overallStatus.value = 'failed'
      throw error
    }
  }

  /**
   * 重置狀態
   */
  function reset() {
    stopPolling()

    jobId.value = null
    segments.value = []
    overallStatus.value = 'idle'
    progress.value = { total: 0, completed: 0, failed: 0, processing: 0 }
    totalDuration.value = 0

    currentPlayingIndex.value = 0
    globalCurrentTime.value = 0
    isPlaying.value = false
  }

  // ============================================
  // Lifecycle
  // ============================================

  // 組件卸載時停止 polling
  onUnmounted(() => {
    stopPolling()
  })

  return {
    // State
    jobId,
    segments,
    overallStatus,
    progress,
    totalDuration,
    isPolling,

    // 播放狀態
    currentPlayingIndex,
    globalCurrentTime,
    isPlaying,

    // Computed
    isGenerating,
    overallProgress,
    completedSegments,
    currentSegment,
    localCurrentTime,
    currentSubtitle,
    timelineTracks,

    // Actions
    startSegmentedGeneration,
    startPolling,
    stopPolling,
    regenerateSegment,
    recalculateGlobalTimes,
    setGlobalTime,
    setPlaying,
    seekToSegment,
    loadJob,
    reset,
  }
})
