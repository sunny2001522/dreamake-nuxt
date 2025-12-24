import { nanoid } from 'nanoid'
import type {
  AspectRatio,
  SubtitleFont,
  SubtitleBackground,
  VideoModel,
  GenerationStage,
  GenerationRecord,
  SavedVoice,
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
  videoModel: VideoModel
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
  videoModel: 'vidnoz',
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
  }
})
