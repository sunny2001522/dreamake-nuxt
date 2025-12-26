<script setup lang="ts">
import type { GenerationRecord } from '~/types'

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

// Persona content for topic suggestions
const personaContent = ref('')

// Mobile modals
const showImageModal = ref(false)
const showVoiceModal = ref(false)
const showSettingsModal = ref(false)

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
    generationStore.setStage('voice')
    generationStore.setError(null)

    const speakerId = draft.value.voicePreview!.speakerId!
    const result = await videoGeneration.generateVoice(speakerId, draft.value.transcript)

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
    generationStore.setStage('idle')
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

    generationStore.setStage('video')
    const videoResult = await videoGeneration.pollUntilComplete(
      result.taskId,
      result.pollEndpoint
    )

    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: 'completed',
      audioUrl: result.audioUrl,
      videoUrl: videoResult.videoUrl,
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
  <div class="lg:hidden min-h-[calc(100vh-64px)] pb-20">
    <div class="px-4 py-3 space-y-4">
      <!-- Preview Area (Large) -->
      <div class="relative">
        <CreateVideoPreview class="w-full" />
        <!-- History button -->
        <NuxtLink
          to="/history"
          class="absolute top-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm text-stone-600 shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          紀錄
        </NuxtLink>
      </div>

      <!-- Topic Suggestions -->
      <CreateMobileTopicSuggestions
        :persona-content="personaContent"
        @persona-update="handlePersonaUpdate"
      />

      <!-- Transcript Input (Simplified) -->
      <CreateMobileTranscriptInput />

      <!-- Generation Progress -->
      <CreateGenerationProgress v-if="isGenerating" />
    </div>

    <!-- Mobile Bottom Toolbar -->
    <CreateMobileToolbar
      @open-image-picker="showImageModal = true"
      @open-voice-picker="showVoiceModal = true"
      @open-settings="showSettingsModal = true"
      @generate-voice="handleGenerateVoice"
      @generate-video="handleGenerateVideo"
    />

    <!-- Image Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showImageModal"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        @click="showImageModal = false"
      >
        <div
          class="w-full max-h-[80vh] bg-white rounded-t-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b">
            <h3 class="font-medium">選擇頭像</h3>
            <button @click="showImageModal = false" class="p-1">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[60vh]">
            <ImageUploader @select="showImageModal = false" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Voice Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showVoiceModal"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        @click="showVoiceModal = false"
      >
        <div
          class="w-full max-h-[80vh] bg-white rounded-t-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b">
            <h3 class="font-medium">選擇語音</h3>
            <button @click="showVoiceModal = false" class="p-1">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[60vh]">
            <VoicePicker @select="showVoiceModal = false" />
          </div>
        </div>
      </div>
    </Teleport>

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
        <div class="h-full overflow-y-auto space-y-3">
          <!-- Step 1 & 2: Image and Voice side by side -->
          <div class="grid grid-cols-2 gap-3">
            <ImageUploader />
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
        </div>

        <!-- Right Column: Preview -->
        <div class="h-full flex flex-col min-h-0">
          <!-- Video Preview -->
          <div class="flex-1 min-h-0 flex items-center justify-center">
            <CreateVideoPreview />
          </div>

          <!-- Generation Progress -->
          <CreateGenerationProgress class="mt-3 flex-shrink-0" />
        </div>
      </div>
    </div>
  </div>
</template>
