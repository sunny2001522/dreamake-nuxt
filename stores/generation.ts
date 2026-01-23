import { nanoid } from 'nanoid'
import type {
  AspectRatio,
  SubtitleFont,
  SubtitleBackground,
  SubtitleStyleType,
  VideoModel,
  GenerationStage,
  GenerationRecord,
  SavedVoice,
  TimedSegment,
} from '~/types'

// 從 subtitleStyle 推斷字幕設定
function migrateSubtitleStyle(style?: SubtitleStyleType): {
  enabled: boolean
  font: SubtitleFont
  background: SubtitleBackground
} {
  if (!style || style === 'none') {
    return { enabled: false, font: 'gothic', background: 'black' }
  }
  // gothic, ming -> 對應字體
  if (style === 'gothic' || style === 'ming') {
    return { enabled: true, font: style, background: 'black' }
  }
  // 舊版樣式映射 (white, black, etc.)
  if (style === 'white') {
    return { enabled: true, font: 'gothic', background: 'white' }
  }
  if (style === 'black') {
    return { enabled: true, font: 'gothic', background: 'black' }
  }
  // 其他舊版樣式預設為 gothic + black
  return { enabled: true, font: 'gothic', background: 'black' }
}

interface GenerationDraft {
  id: string
  transcript: string
  title: string
  selectedImageId: number | null
  selectedVoiceId: number | null
  avatarPreview?: string
  avatarRotation: number // 照片旋轉角度 (0, 90, 180, 270)
  avatarPanX: number // 照片水平偏移 (-1 ~ 1)
  avatarPanY: number // 照片垂直偏移 (-1 ~ 1)
  voicePreview?: { name: string; speakerId?: string }
  aspectRatio: AspectRatio
  subtitleEnabled: boolean
  subtitleFont: SubtitleFont
  subtitleBackground: SubtitleBackground
  titleY: number // 標題 Y 位置 (百分比 0-100，從頂部)
  subtitleY: number // 字幕 Y 位置 (百分比 0-100，從頂部)
  videoModel: VideoModel
  waveSpeedPrompt: string
}

const DEFAULT_DRAFT: GenerationDraft = {
  id: nanoid(),
  transcript: '',
  title: '',
  selectedImageId: null,
  selectedVoiceId: null,
  avatarPreview: undefined,
  avatarRotation: 0,
  avatarPanX: 0,
  avatarPanY: 0,
  voicePreview: undefined,
  aspectRatio: 'portrait',
  subtitleEnabled: true,
  subtitleFont: 'gothic',
  subtitleBackground: 'black',
  titleY: 8, // 預設 8% 從頂部
  subtitleY: 66, // 預設 66% (約 2/3 處)
  videoModel: 'wavespeed',
  waveSpeedPrompt: '對著鏡頭講話，侃侃而談，搭配手部動作，輕鬆而自然',
}

export const useGenerationStore = defineStore('generation', () => {
  // Draft state
  const draft = ref<GenerationDraft>({ ...DEFAULT_DRAFT })

  // Generation state
  const stage = ref<GenerationStage>('idle')
  const isGenerating = computed(() => stage.value !== 'idle' && stage.value !== 'complete' && stage.value !== 'error')
  const generatedResult = ref<GenerationRecord | null>(null)
  const error = ref<string | null>(null)
  const stepDurations = ref<Record<string, number>>({})

  // Subtitle state
  const subtitleSegments = ref<TimedSegment[]>([])
  const hasTimestamps = ref(false)
  const isLoadingSubtitles = ref(false)

  // History loading state
  const isLoadingFromHistory = ref(false)

  // Auto-play flag (set when media should auto-play after loading)
  const shouldAutoPlay = ref(false)

  // Debounced save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 500

  // Update draft with debounced auto-save
  function updateDraft(updates: Partial<GenerationDraft>) {
    draft.value = { ...draft.value, ...updates }

    // Debounce save
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    saveTimeout = setTimeout(() => {
      saveDraft()
    }, DEBOUNCE_MS)
  }

  // Save draft to IndexedDB
  async function saveDraft() {
    // TODO: Implement IndexedDB save via useDexie composable
    console.log('Saving draft:', draft.value)
  }

  // Load draft from IndexedDB
  async function loadDraft(userId: string) {
    // TODO: Implement IndexedDB load via useDexie composable
    console.log('Loading draft for user:', userId)
  }

  // Clear draft
  function clearDraft() {
    draft.value = { ...DEFAULT_DRAFT, id: nanoid() }
  }

  // Set voice
  function setVoice(voice: SavedVoice | null) {
    if (voice) {
      draft.value.selectedVoiceId = voice.id ?? null
      draft.value.voicePreview = {
        name: voice.name,
        speakerId: voice.speakerId,
      }
    } else {
      draft.value.selectedVoiceId = null
      draft.value.voicePreview = undefined
    }
  }

  // Set avatar
  function setAvatar(imageId: number | null, preview?: string) {
    draft.value.selectedImageId = imageId
    draft.value.avatarPreview = preview
    draft.value.avatarRotation = 0 // 切換照片時重置旋轉
    draft.value.avatarPanX = 0 // 切換照片時重置平移
    draft.value.avatarPanY = 0
  }

  // Set avatar rotation
  function setAvatarRotation(rotation: number) {
    draft.value.avatarRotation = rotation
  }

  // Start generation (stage management)
  function setStage(newStage: GenerationStage) {
    stage.value = newStage
  }

  // Record step duration
  function recordStepDuration(step: string, duration: number) {
    stepDurations.value[step] = duration
  }

  // Set generation result
  function setResult(result: GenerationRecord) {
    generatedResult.value = result
    shouldAutoPlay.value = true
  }

  // Set error
  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  // Reset generation state
  function resetGeneration() {
    stage.value = 'idle'
    error.value = null
    stepDurations.value = {}
    subtitleSegments.value = []
    hasTimestamps.value = false
    isLoadingSubtitles.value = false
    shouldAutoPlay.value = false
  }

  // Set subtitle segments
  function setSubtitleSegments(segments: TimedSegment[], withTimestamps: boolean = false) {
    subtitleSegments.value = segments
    hasTimestamps.value = withTimestamps
  }

  // Set subtitle loading state
  function setLoadingSubtitles(loading: boolean) {
    isLoadingSubtitles.value = loading
  }

  // Clear subtitle segments
  function clearSubtitles() {
    subtitleSegments.value = []
    hasTimestamps.value = false
  }

  // Simple text segmentation for quick subtitle generation
  // PRIORITY: Split by punctuation first, then by character count if needed
  function simpleTextSegmentation(transcript: string): TimedSegment[] {
    if (!transcript.trim()) return []

    // Step 1: Split by punctuation first (priority over character count)
    const punctuationPattern = /[，。！？、；：,\.!?\n]+/g
    const rawSegments = transcript
      .split(punctuationPattern)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    // Step 2: Further split segments that are too long (>15 chars)
    const textSegments: string[] = []
    const maxChars = 15

    for (const segment of rawSegments) {
      if (getChineseCharCount(segment) <= maxChars) {
        textSegments.push(segment)
      } else {
        // Split long segments
        const subSegments = splitLongSegment(segment, maxChars)
        textSegments.push(...subSegments)
      }
    }

    // Step 3: Clean and convert to TimedSegment
    return textSegments.map(text => ({
      text: cleanSegmentText(text),
      startTime: -1,
      endTime: -1,
    }))
  }

  // Helper: Count Chinese characters (Chinese = 1, ASCII = 0.5)
  function getChineseCharCount(text: string): number {
    let count = 0
    for (const char of text) {
      if (char.charCodeAt(0) > 127) {
        count++
      } else {
        count += 0.5
      }
    }
    return Math.ceil(count)
  }

  // Helper: Split long segment into smaller chunks
  function splitLongSegment(text: string, maxChars: number): string[] {
    const results: string[] = []
    let current = ''

    for (const char of text) {
      current += char
      if (getChineseCharCount(current) >= maxChars) {
        results.push(current)
        current = ''
      }
    }

    if (current.length > 0) {
      // If too short, merge with previous segment
      if (results.length > 0 && getChineseCharCount(current) < 3) {
        results[results.length - 1] += current
      } else {
        results.push(current)
      }
    }

    return results
  }

  // Helper: Clean text by removing punctuation and extra spaces
  function cleanSegmentText(text: string): string {
    return text
      .replace(/[，。！？、；：""''（）【】《》,\.!?\-—\[\]「」『』：\s]+/g, '')
      .trim()
  }

  // Load from history record
  async function loadFromHistory(item: GenerationRecord) {
    // 開始載入
    isLoadingFromHistory.value = true
    shouldAutoPlay.value = true

    // 從 subtitleStyle 推斷字幕設定
    const subtitleConfig = migrateSubtitleStyle(item.subtitleStyle)

    // FIX: 在設定 generatedResult 之前先設定 isLoadingSubtitles
    // 這樣當 VideoPreview 的 onLoadedMetadata 觸發時，會正確等待字幕載入
    // 避免競爭條件：影片快取時 onLoadedMetadata 可能在同一 tick 內觸發
    const willLoadSubtitles = subtitleConfig.enabled && item.transcript && item.audioUrl
    if (willLoadSubtitles) {
      isLoadingSubtitles.value = true
      subtitleSegments.value = []
      hasTimestamps.value = false
    }

    // Update draft with history item data
    draft.value = {
      ...draft.value,
      transcript: item.transcript,
      title: item.title || '',
      avatarPreview: item.avatarPreview,
      aspectRatio: item.aspectRatio,
      voicePreview: item.speakerId
        ? { name: item.voicePreview || '已保存的聲音', speakerId: item.speakerId }
        : undefined,
      // 恢復字幕設定
      subtitleEnabled: subtitleConfig.enabled,
      subtitleFont: subtitleConfig.font,
      subtitleBackground: subtitleConfig.background,
    }

    // Reset generation state
    stage.value = 'complete'
    error.value = null

    // 設置 generatedResult（觸發 VideoPreview 渲染）
    generatedResult.value = item

    // 呼叫 Whisper API
    if (willLoadSubtitles) {
      console.log('[Subtitle] Calling Whisper API for:', item.audioUrl!.substring(0, 60))

      try {
        const result = await $fetch('/api/subtitle', {
          method: 'POST',
          body: {
            audioUrl: item.audioUrl,
            transcript: item.transcript,
          },
        }) as { segments: TimedSegment[]; hasTimestamps: boolean }

        subtitleSegments.value = result.segments
        hasTimestamps.value = result.hasTimestamps
        console.log('[Subtitle] Whisper API success:', result.segments.length, 'segments')
      } catch (err) {
        console.warn('[Subtitle] Whisper API failed, using quick subtitles:', err)
        // Fallback 到快速字幕
        const quickSegments = simpleTextSegmentation(item.transcript)
        subtitleSegments.value = quickSegments
        hasTimestamps.value = false
      } finally {
        isLoadingSubtitles.value = false
      }
    } else if (subtitleConfig.enabled && item.transcript) {
      // 沒有 audioUrl 時才用快速字幕（fallback）
      const quickSegments = simpleTextSegmentation(item.transcript)
      subtitleSegments.value = quickSegments
      hasTimestamps.value = false
      console.log('No audio URL, using quick subtitles:', quickSegments.length)
    } else {
      subtitleSegments.value = []
      hasTimestamps.value = false
    }
  }

  // Clear history loading state (called when media is ready)
  function clearHistoryLoading() {
    isLoadingFromHistory.value = false
  }

  return {
    // Draft
    draft,
    updateDraft,
    saveDraft,
    loadDraft,
    clearDraft,
    setVoice,
    setAvatar,
    setAvatarRotation,

    // Generation
    stage,
    isGenerating,
    generatedResult,
    error,
    stepDurations,
    setStage,
    recordStepDuration,
    setResult,
    setError,
    resetGeneration,

    // Subtitles
    subtitleSegments,
    hasTimestamps,
    isLoadingSubtitles,
    setSubtitleSegments,
    setLoadingSubtitles,
    clearSubtitles,

    // History
    loadFromHistory,
    isLoadingFromHistory,
    clearHistoryLoading,

    // Auto-play
    shouldAutoPlay,
    clearAutoPlay: () => { shouldAutoPlay.value = false },
  }
})
