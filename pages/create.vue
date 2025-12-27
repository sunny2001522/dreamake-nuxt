<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
// Note: auth is handled by auth.global.ts middleware

const authStore = useAuthStore()
const generationStore = useGenerationStore()
const preferencesStore = usePreferencesStore()
const toastStore = useToastStore()
const router = useRouter()

const { draft, isGenerating } = storeToRefs(generationStore)

// 監聽照片、聲音、逐字稿變化，清空歷史預覽（不包含標題）
watch(
  () => ({
    avatar: draft.value.avatarPreview,
    voice: draft.value.voicePreview?.speakerId,
    transcript: draft.value.transcript,
  }),
  (newVal, oldVal) => {
    // 只有在有歷史預覽時才需要清空
    if (generationStore.generatedResult && oldVal) {
      if (
        newVal.avatar !== oldVal.avatar ||
        newVal.voice !== oldVal.voice ||
        newVal.transcript !== oldVal.transcript
      ) {
        generationStore.generatedResult = null
      }
    }
  }
)

// 監聽歷史載入，自動生成字幕
watch(
  () => generationStore.generatedResult,
  async (newResult) => {
    // 只在載入歷史記錄時觸發（有 audioUrl 但沒有字幕）
    if (
      newResult?.audioUrl &&
      draft.value.subtitleEnabled &&
      generationStore.subtitleSegments.length === 0 &&
      !generationStore.isLoadingSubtitles
    ) {
      console.log('Loading history item, generating subtitles...')
      await generateSubtitles(newResult.audioUrl, newResult.transcript)
    }
  },
  { immediate: false }
)

// Persona content for topic suggestions
const personaContent = ref('')

// Mobile modals
const showSettingsModal = ref(false)

// Desktop history sidebar
const showHistorySidebar = ref(false)

// Ref to ImageUploader and VoicePicker for direct modal access
const imageUploaderRef = ref<{ openModal: () => void } | null>(null)
const voicePickerRef = ref<{ openModal: () => void } | null>(null)

function handleOpenImagePicker() {
  imageUploaderRef.value?.openModal()
}

function handleOpenVoicePicker() {
  voicePickerRef.value?.openModal()
}

function handlePersonaUpdate(content: string) {
  personaContent.value = content
}

// Load user data on mount
onMounted(async () => {
  if (authStore.user) {
    // Use CMoney email as user identifier for data association
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    await Promise.all([
      generationStore.loadDraft(userId),
      preferencesStore.loadPreferences(userId),
    ])

    // Load saved persona if exists
    const personaId = preferencesStore.preferences?.persona_id
    if (personaId) {
      try {
        const { getPersonaById } = usePersonaStorage()
        const persona = await getPersonaById(personaId)
        if (persona) {
          personaContent.value = persona.content
        }
      } catch (err) {
        console.error('Failed to load saved persona:', err)
      }
    }
  }
})

// Generation handlers for mobile toolbar
const videoGeneration = useVideoGeneration()

// Subtitle generation helper
async function generateSubtitles(audioUrl: string, transcript: string) {
  if (!draft.value.subtitleEnabled) return

  try {
    generationStore.setLoadingSubtitles(true)

    // Fetch audio as blob
    const audioResponse = await fetch(audioUrl)
    const audioBlob = await audioResponse.blob()

    // Create form data
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.mp3')
    formData.append('transcript', transcript)

    // Call subtitle generation API
    const response = await $fetch('/api/subtitle', {
      method: 'POST',
      body: formData,
    })

    const result = response as {
      segments: Array<{ text: string; startTime: number; endTime: number }>
      hasTimestamps: boolean
      source: string
    }

    generationStore.setSubtitleSegments(result.segments, result.hasTimestamps)
    console.log('Subtitles generated:', {
      count: result.segments.length,
      hasTimestamps: result.hasTimestamps,
      source: result.source,
    })
  } catch (err) {
    console.error('Failed to generate subtitles:', err)
    // Fallback: generate simple text segments
    const segments = simpleTextSegmentation(transcript)
    generationStore.setSubtitleSegments(segments, false)
  } finally {
    generationStore.setLoadingSubtitles(false)
  }
}

// Simple text segmentation fallback
function simpleTextSegmentation(transcript: string) {
  const cleanText = transcript.replace(/[，。！？、；：""''（）【】《》\s]+/g, '').trim()
  if (!cleanText) return []

  const segments: Array<{ text: string; startTime: number; endTime: number }> = []
  const minChars = 6
  const maxChars = 10

  let i = 0
  while (i < cleanText.length) {
    const remainingChars = cleanText.length - i
    let segmentLength = Math.min(maxChars, remainingChars)

    if (remainingChars <= maxChars) {
      segmentLength = remainingChars
    } else if (remainingChars - maxChars < minChars) {
      segmentLength = Math.ceil(remainingChars / 2)
    }

    segments.push({
      text: cleanText.slice(i, i + segmentLength),
      startTime: -1,
      endTime: -1,
    })
    i += segmentLength
  }
  return segments
}

async function handleGenerateVoice() {
  if (!draft.value.transcript.trim() || !draft.value.avatarPreview || !draft.value.voicePreview?.speakerId) {
    toastStore.warning('請先填寫腳本、選擇頭像和語音')
    return
  }

  if (!authStore.user) {
    toastStore.error('請先登入帳號以使用生成功能')
    router.push('/auth')
    return
  }

  try {
    generationStore.resetGeneration()
    generationStore.setStage('voice')
    generationStore.setError(null)

    const speakerId = draft.value.voicePreview!.speakerId!
    const result = await videoGeneration.generateVoice(speakerId, draft.value.transcript)

    // Generate subtitles from audio
    if (draft.value.subtitleEnabled) {
      generationStore.setStage('subtitle')
      await generateSubtitles(result.audioUrl, draft.value.transcript)
    }

    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: 'completed',
      audioUrl: result.audioUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: draft.value.avatarPreview,
    }

    generationStore.setResult(record)
    generationStore.setStage('complete')
    toastStore.success('語音生成完成！')
  } catch (err: any) {
    console.error('Voice generation failed:', err)
    generationStore.setError(err.message || '語音生成失敗')
    generationStore.setStage('error')
    toastStore.error('語音生成失敗', err.message)
  }
}

async function handleGenerateVideo() {
  if (!draft.value.transcript.trim() || !draft.value.avatarPreview || !draft.value.voicePreview?.speakerId) {
    toastStore.warning('請先填寫腳本、選擇頭像和語音')
    return
  }

  if (!authStore.user) {
    toastStore.error('請先登入帳號以使用生成功能')
    router.push('/auth')
    return
  }

  try {
    generationStore.resetGeneration()
    generationStore.setStage('voice')

    const speakerId = draft.value.voicePreview!.speakerId!
    const avatarUrl = draft.value.avatarPreview

    const result = await videoGeneration.startGeneration({
      transcript: draft.value.transcript,
      speakerId,
      avatarUrl,
      aspectRatio: draft.value.aspectRatio,
      videoModel: draft.value.videoModel,
      waveSpeedPrompt: draft.value.waveSpeedPrompt,
    })

    // Generate subtitles in parallel with video generation
    if (draft.value.subtitleEnabled) {
      generationStore.setStage('subtitle')
      await generateSubtitles(result.audioUrl, draft.value.transcript)
    }

    generationStore.setStage('video')
    const videoResult = await videoGeneration.pollUntilComplete(
      result.taskId,
      result.pollEndpoint
    )

    // Upload video to Supabase Storage for permanent URL
    const { uploadVideoToStorage } = useVideoStorage()
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    let permanentVideoUrl = videoResult.videoUrl

    try {
      toastStore.info('正在保存影片...')
      permanentVideoUrl = await uploadVideoToStorage(videoResult.videoUrl, userId)
    } catch (uploadErr) {
      console.warn('Failed to upload video to storage, using original URL:', uploadErr)
      // If upload fails, still use original URL (though it may expire)
    }

    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: 'completed',
      audioUrl: result.audioUrl,
      videoUrl: permanentVideoUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: avatarUrl,
    }

    generationStore.setResult(record)
    generationStore.setStage('complete')
    toastStore.success('影片生成完成！')
  } catch (err: any) {
    console.error('Video generation failed:', err)
    generationStore.setError(err.message || '影片生成失敗')
    generationStore.setStage('error')
    toastStore.error('影片生成失敗', err.message)
  }
}
</script>

<template>
  <!-- Mobile Layout -->
  <div class="lg:hidden h-[calc(100vh-64px)] flex flex-col overflow-hidden">
    <div class="flex-1 flex flex-col min-h-0 px-4 py-2 gap-2 pb-20">
      <!-- Preview Area (Flexible) -->
      <div class="relative flex-1 min-h-0 flex items-center justify-center">
        <CreateVideoPreview class="w-full h-full" />
        <!-- History button -->
        <NuxtLink
          to="/history"
          class="absolute top-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm text-stone-600 shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          
        </NuxtLink>
      </div>

      <!-- Topic Suggestions -->
      <CreateMobileTopicSuggestions
        class="flex-shrink-0"
        :persona-content="personaContent"
        @persona-update="handlePersonaUpdate"
      />

      <!-- Transcript Input (Simplified) -->
      <CreateMobileTranscriptInput class="flex-shrink-0" />

      <!-- Generation Progress -->
      <CreateGenerationProgress v-if="isGenerating" class="flex-shrink-0" />
    </div>

    <!-- Mobile Bottom Toolbar -->
    <CreateMobileToolbar
      @open-image-picker="handleOpenImagePicker"
      @open-voice-picker="handleOpenVoicePicker"
      @open-settings="showSettingsModal = true"
      @generate-voice="handleGenerateVoice"
      @generate-video="handleGenerateVideo"
    />

    <!-- Hidden VoicePicker for mobile (modal is teleported to body) -->
    <VoicePicker ref="voicePickerRef" class="hidden" />

    <!-- Settings Modal -->
    <Teleport to="body">
      <div
        v-if="showSettingsModal"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        @click="showSettingsModal = false"
      >
        <div
          class="w-full max-h-[80vh] bg-white rounded-t-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b">
            <h3 class="font-medium">設定</h3>
            <button @click="showSettingsModal = false" class="p-1">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[60vh] space-y-4">
            <CreateSubtitleSettings />
            <CreateVideoModelSelector />
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Desktop Layout -->
  <div class="hidden lg:block h-[calc(100vh-64px)] overflow-hidden">
    <div class="container mx-auto px-4 h-full">
      <div class="grid grid-cols-2 gap-6 py-3 h-full">
        <!-- Left Column: Inputs -->
        <div class="relative h-full overflow-y-auto space-y-3">
          <!-- Step 1 & 2: Image and Voice side by side -->
          <div class="grid grid-cols-2 gap-3">
            <ImageUploader ref="imageUploaderRef" />
            <VoicePicker />
          </div>

          <!-- Step 3: Transcript Input (includes PersonaPanel trigger + TopicSuggestions) -->
          <CreateTranscriptInput
            :persona-content="personaContent"
            @persona-update="handlePersonaUpdate"
          />

          <!-- Subtitle Settings -->
          <CreateSubtitleSettings />

          <!-- Generate Buttons with inline settings -->
          <CreateGenerateButtons />

          <!-- Generating Overlay -->
          <div
            v-if="isGenerating"
            class="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center overflow-hidden rounded-lg"
          >
            <div class="ripple-container">
              <div class="ripple"></div>
              <div class="ripple"></div>
              <div class="ripple"></div>
            </div>
          </div>
        </div>

        <!-- Right Column: Preview -->
        <div class="h-full flex flex-col min-h-0">
          <!-- Video Preview -->
          <div class="relative flex-1 min-h-0 flex items-center justify-center">
            <CreateVideoPreview />
            <!-- Desktop History button -->
            <button
              @click="showHistorySidebar = true"
              class="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm text-stone-600 shadow-sm hover:bg-white hover:shadow-md transition-all"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>歷史</span>
            </button>
          </div>

          <!-- Generation Progress -->
          <CreateGenerationProgress class="mt-3 flex-shrink-0" />
        </div>
      </div>
    </div>
  </div>

  <!-- Desktop History Sidebar -->
  <CreateHistorySidebar v-model="showHistorySidebar" />
</template>

<style scoped>
.ripple-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.ripple {
  position: absolute;
  inset: 0;
  border: 3px solid #a855f7;
  border-radius: 50%;
  opacity: 0;
  animation: ripple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
}

.ripple:nth-child(2) {
  animation-delay: 0.5s;
}

.ripple:nth-child(3) {
  animation-delay: 1s;
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
