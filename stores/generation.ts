import { nanoid } from 'nanoid'
import type {
  AspectRatio,
  SubtitleFont,
  SubtitleBackground,
  VideoModel,
  GenerationStage,
  GenerationRecord,
  SavedVoice,
  TimedSegment,
} from '~/types'

interface GenerationDraft {
  id: string
  transcript: string
  title: string
  selectedImageId: number | null
  selectedVoiceId: number | null
  avatarPreview?: string
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
  voicePreview: undefined,
  aspectRatio: 'portrait',
  subtitleEnabled: true,
  subtitleFont: 'gothic',
  subtitleBackground: 'black',
  titleY: 8, // 預設 8% 從頂部
  subtitleY: 66, // 預設 66% (約 2/3 處)
  videoModel: 'vidnoz',
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

  // Load from history record
  function loadFromHistory(item: GenerationRecord) {
    // Update draft with history item data
    draft.value = {
      ...draft.value,
      transcript: item.transcript,
      title: item.title || '',
      avatarPreview: item.avatarPreview,
      aspectRatio: item.aspectRatio,
      voicePreview: item.speakerId
        ? { name: '已保存語音', speakerId: item.speakerId }
        : undefined,
    }

    // Set generated result to show in preview
    generatedResult.value = item

    // Reset generation state
    stage.value = 'complete'
    error.value = null
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
  }
})
