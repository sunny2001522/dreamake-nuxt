<script setup lang="ts">
import type { SavedVoice } from '~/types'
import { ensureCompatibleFormat } from '~/utils/audioConverter'

const generationStore = useGenerationStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

// Constants
const MIN_AUDIO_DURATION = 20
const MAX_AUDIO_DURATION = 40

// Modal state
const showModal = ref(false)
const modalTab = ref<'history' | 'record' | 'upload'>('history')
const isDragging = ref(false)

// Saved voices
const savedVoices = ref<SavedVoice[]>([])
const isLoadingVoices = ref(false)
const deletingId = ref<string | null>(null)

// Recording state
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingTimer = ref<NodeJS.Timeout | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])

// Upload state
const isProcessing = ref(false)
const uploadProgress = ref<string | null>(null)

// File input ref
const fileInputRef = ref<HTMLInputElement | null>(null)

// Cloning state
const isCloning = ref(false)
const cloningVoiceName = ref<string | null>(null)

// Audio preview state
const previewingVoiceId = ref<string | null>(null)
const previewAudio = ref<HTMLAudioElement | null>(null)
const generatingPreviewId = ref<string | null>(null)
const previewCache = ref<Map<string, string>>(new Map())

// Load saved voices on mount
onMounted(() => {
  if (authStore.user) {
    loadSavedVoices()
  }
})

// Watch for auth changes
watch(() => authStore.user, (user) => {
  if (user) {
    loadSavedVoices()
  } else {
    savedVoices.value = []
  }
})

// Watch for preferences changes and apply default voice
watch(
  () => preferencesStore.preferences?.voice_id,
  async (voiceId) => {
    // Only apply if we don't already have a voice selected
    if (voiceId && !draft.value.voicePreview) {
      // Find the voice in savedVoices
      const matchedVoice = savedVoices.value.find(v => v.supabaseId === voiceId)
      if (matchedVoice) {
        applyDefaultVoice(matchedVoice)
        console.log('Applied default voice from preferences:', matchedVoice.name)
      }
    }
  }
)

// Also check after savedVoices are loaded
watch(savedVoices, (voices) => {
  const voiceId = preferencesStore.preferences?.voice_id
  if (voiceId && voices.length > 0 && !draft.value.voicePreview) {
    const matchedVoice = voices.find(v => v.supabaseId === voiceId)
    if (matchedVoice) {
      applyDefaultVoice(matchedVoice)
      console.log('Applied default voice after loading:', matchedVoice.name)
    }
  }
})

// Apply default voice without closing modal
function applyDefaultVoice(voice: SavedVoice) {
  generationStore.setVoice(voice)
}

async function loadSavedVoices() {
  if (!authStore.user) return

  try {
    isLoadingVoices.value = true
    const { getAllVoices } = useVoiceStorage()
    const userId = authStore.authInfo.email || authStore.authInfo.sub

    const dbVoices = await getAllVoices(userId)

    savedVoices.value = dbVoices.map(voice => ({
      id: parseInt(voice.id) || undefined,
      supabaseId: voice.id,
      name: voice.name,
      speakerId: voice.speaker_id,
      originalFileName: voice.original_file_name,
      audioUrl: voice.audio_url || undefined,
      audioMimeType: voice.audio_mime_type || undefined,
      createdAt: new Date(voice.created_at),
      lastUsedAt: new Date(voice.last_used_at),
      useCount: voice.use_count,
    }))
  } catch (err) {
    console.error('Failed to load saved voices:', err)
  } finally {
    isLoadingVoices.value = false
  }
}

function handleClick() {
  openModal()
}

function openModal() {
  showModal.value = true
  modalTab.value = savedVoices.value.length > 0 ? 'history' : 'record'
}

defineExpose({ openModal })

function handleCloseModal() {
  stopRecording()
  showModal.value = false
}

// Recording functions
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    mediaRecorder.value = new MediaRecorder(stream, { mimeType })
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())

      if (audioChunks.value.length > 0) {
        const audioBlob = new Blob(audioChunks.value, { type: mimeType })
        await processRecordedAudio(audioBlob)
      }
    }

    mediaRecorder.value.start(100)
    isRecording.value = true
    recordingDuration.value = 0

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++

      // Auto-stop at max duration
      if (recordingDuration.value >= MAX_AUDIO_DURATION) {
        stopRecording()
      }
    }, 1000)
  } catch (err) {
    console.error('Failed to start recording:', err)
    toastStore.error('無法啟動麥克風')
  }
}

function stopRecording() {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }

  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
  }
}

async function processRecordedAudio(blob: Blob) {
  if (recordingDuration.value < MIN_AUDIO_DURATION) {
    toastStore.warning(`錄音太短，請至少錄製 ${MIN_AUDIO_DURATION} 秒`)
    return
  }

  try {
    isProcessing.value = true
    uploadProgress.value = '處理中...'

    // Create a file from the blob
    const fileName = `recording-${Date.now()}.webm`
    const file = new File([blob], fileName, { type: blob.type })

    // Clone the voice
    await cloneVoice(file, `語音 ${new Date().toLocaleDateString('zh-TW')}`)
  } finally {
    isProcessing.value = false
    uploadProgress.value = null
  }
}

// Upload handling
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false

  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  await processUploadedFile(file)
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  processUploadedFile(file)

  // Reset input
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function processUploadedFile(file: File) {
  // Validate file type
  const validTypes = ['audio/', 'video/']
  if (!validTypes.some(type => file.type.startsWith(type))) {
    toastStore.warning('請上傳音訊或影片檔案')
    return
  }

  try {
    isProcessing.value = true
    uploadProgress.value = '處理檔案...'

    // Get base name for the voice
    const baseName = file.name.replace(/\.[^.]+$/, '')

    // Clone the voice
    await cloneVoice(file, baseName)
  } finally {
    isProcessing.value = false
    uploadProgress.value = null
  }
}

async function cloneVoice(file: File, name: string) {
  try {
    isCloning.value = true
    cloningVoiceName.value = name
    uploadProgress.value = '壓縮音檔中...'

    // Convert audio to compressed WAV format for API compatibility
    let processedFile: File
    try {
      processedFile = await ensureCompatibleFormat(file)
      console.log('Audio processed:', {
        original: { name: file.name, size: file.size },
        processed: { name: processedFile.name, size: processedFile.size },
      })
    } catch (conversionError) {
      console.error('Audio conversion failed:', conversionError)
      toastStore.error('音檔轉換失敗', '請嘗試使用 MP3 或 WAV 格式的音檔')
      return
    }

    uploadProgress.value = '克隆語音中...'

    const formData = new FormData()
    formData.append('audio', processedFile)
    formData.append('name', name)

    const response = await $fetch<{ speakerId: string }>('/api/voice/clone', {
      method: 'POST',
      body: formData,
    })

    // Create saved voice object
    const voice: SavedVoice = {
      name,
      speakerId: response.speakerId,
      originalFileName: file.name,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 0,
    }

    // Add to saved voices
    savedVoices.value.unshift(voice)

    // Select the voice
    generationStore.setVoice(voice)

    toastStore.success('語音克隆完成！')
    showModal.value = false
  } catch (err: any) {
    console.error('Voice cloning failed:', err)
    toastStore.error('語音克隆失敗', err.message || '請稍後再試')
  } finally {
    isCloning.value = false
    cloningVoiceName.value = null
    uploadProgress.value = null
  }
}

async function handleSelectVoice(voice: SavedVoice) {
  generationStore.setVoice(voice)
  showModal.value = false
  toastStore.success(`已選擇語音: ${voice.name}`)

  // Save to preferences
  if (voice.supabaseId && authStore.user) {
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    const { updateVoicePreference } = usePreferencesStorage()
    try {
      await updateVoicePreference(userId, voice.supabaseId)
      console.log('Voice preference saved:', voice.supabaseId)
    } catch (err) {
      console.error('Failed to save voice preference:', err)
    }
  }
}

async function handleDeleteVoice(event: Event, voice: SavedVoice) {
  event.stopPropagation()
  const deleteKey = voice.supabaseId || String(voice.id)
  deletingId.value = deleteKey

  try {
    // TODO: Delete from Supabase
    // await $fetch(`/api/voice/${deleteKey}`, { method: 'DELETE' })

    savedVoices.value = savedVoices.value.filter(v =>
      (v.supabaseId || String(v.id)) !== deleteKey
    )

    // Clear selection if deleted voice was selected
    if (draft.value.voicePreview?.speakerId === voice.speakerId) {
      generationStore.setVoice(null)
    }

    toastStore.success('語音已刪除')
  } catch (err) {
    console.error('Failed to delete voice:', err)
    toastStore.error('刪除失敗')
  } finally {
    deletingId.value = null
  }
}

function handleClearVoice() {
  generationStore.setVoice(null)
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const hasSavedVoices = computed(() => savedVoices.value.length > 0)
const recordingProgress = computed(() => (recordingDuration.value / MAX_AUDIO_DURATION) * 100)

// Audio preview functions
async function generateVoicePreview(voice: SavedVoice): Promise<string | null> {
  const voiceId = voice.supabaseId || String(voice.id)

  // 檢查快取
  if (previewCache.value.has(voiceId)) {
    return previewCache.value.get(voiceId)!
  }

  // 調用 TTS API 生成「歡迎追蹤我」
  const response = await $fetch('/api/voice/tts', {
    method: 'POST',
    body: {
      speakerId: voice.speakerId,
      transcript: '歡迎追蹤我',
    },
  })

  if (response.success && response.audioUrl) {
    previewCache.value.set(voiceId, response.audioUrl)
    return response.audioUrl
  }

  return null
}

async function handlePreviewVoice(event: Event, voice: SavedVoice) {
  event.stopPropagation()

  const voiceId = voice.supabaseId || String(voice.id)

  // 如果正在生成，忽略
  if (generatingPreviewId.value === voiceId) return

  // 如果正在播放此語音，停止它
  if (previewingVoiceId.value === voiceId) {
    stopPreview()
    return
  }

  // 停止當前預覽
  stopPreview()

  // 顯示載入狀態
  generatingPreviewId.value = voiceId

  try {
    // 生成或獲取快取的預覽音頻
    const audioUrl = await generateVoicePreview(voice)

    if (!audioUrl) {
      toastStore.error('生成預覽失敗')
      return
    }

    // 播放預覽
    previewingVoiceId.value = voiceId
    previewAudio.value = new Audio(audioUrl)
    previewAudio.value.play()

    previewAudio.value.onended = () => {
      previewingVoiceId.value = null
      previewAudio.value = null
    }

    previewAudio.value.onerror = () => {
      previewingVoiceId.value = null
      previewAudio.value = null
    }
  } catch (error) {
    console.error('Preview generation failed:', error)
    toastStore.error('生成預覽失敗')
  } finally {
    generatingPreviewId.value = null
  }
}

function stopPreview() {
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value = null
  }
  previewingVoiceId.value = null
}

// Clean up on unmount
onUnmounted(() => {
  stopPreview()
})
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">聲音</label>
      <span class="text-xs text-stone-400">選擇要模仿的人聲</span>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*,video/*"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Selected Voice Preview -->
    <div
      v-if="draft.voicePreview"
      class="flex items-center gap-3 p-3 bg-stone-100 rounded-xl"
    >
      <div class="w-10 h-10 bg-stone-700 rounded-full flex items-center justify-center">
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-stone-800 truncate">{{ draft.voicePreview.name }}</p>
        <p class="text-xs text-stone-500">已選擇</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
          @click="handleClick"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          class="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          @click="handleClearVoice"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Empty State Button -->
    <button
      v-else
      class="w-full p-6 border-2 border-dashed border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-colors text-center"
      @click="handleClick"
    >
      <svg class="w-8 h-8 mx-auto mb-2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <p class="text-sm text-stone-500">
        {{ savedVoices.length > 0 ? savedVoices[0].name : '選擇或錄製語音' }}
      </p>
    </button>

    <!-- Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="handleCloseModal"
      >
        <div
          class="flex flex-col bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[800px] max-w-[90vw] h-[80vh] max-h-[600px]"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">選擇語音</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="handleCloseModal"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tab Toggle -->
          <div class="px-4 py-3 bg-stone-50 border-b border-stone-200">
            <div class="flex rounded-lg bg-stone-200 p-1">
              <button
                v-if="hasSavedVoices"
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'history'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'history'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                歷史語音
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'record'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'record'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                錄製語音
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'upload'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'upload'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                上傳檔案
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto p-4">
            <!-- History Tab -->
            <div v-if="modalTab === 'history'">
              <div v-if="isLoadingVoices" class="flex items-center justify-center py-12">
                <svg class="animate-spin w-8 h-8 text-stone-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div v-else-if="savedVoices.length === 0" class="text-center py-12 text-stone-500">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p>尚無歷史語音</p>
                <p class="text-sm mt-1">錄製或上傳語音來開始</p>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="voice in savedVoices"
                  :key="voice.supabaseId || voice.id"
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group"
                  :class="draft.voicePreview?.speakerId === voice.speakerId
                    ? 'bg-stone-200 border-2 border-stone-600'
                    : 'bg-stone-50 hover:bg-stone-100 border-2 border-transparent'"
                  @click="handleSelectVoice(voice)"
                >
                  <!-- Preview play button -->
                  <button
                    class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    :class="[
                      generatingPreviewId === (voice.supabaseId || String(voice.id))
                        ? 'bg-stone-500 cursor-wait'
                        : previewingVoiceId === (voice.supabaseId || String(voice.id))
                          ? 'bg-stone-800 hover:bg-stone-900'
                          : 'bg-stone-700 hover:bg-stone-800'
                    ]"
                    :disabled="generatingPreviewId === (voice.supabaseId || String(voice.id))"
                    @click="handlePreviewVoice($event, voice)"
                  >
                    <!-- Loading spinner - 生成中 -->
                    <svg
                      v-if="generatingPreviewId === (voice.supabaseId || String(voice.id))"
                      class="animate-spin w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <!-- 音波動畫 - 播放中 -->
                    <div
                      v-else-if="previewingVoiceId === (voice.supabaseId || String(voice.id))"
                      class="flex items-center justify-center gap-0.5 w-4 h-4"
                    >
                      <div
                        v-for="i in 4"
                        :key="i"
                        class="w-0.5 bg-white rounded-full animate-audio-wave"
                        :style="{
                          height: `${8 + Math.sin((i - 1) * 0.8) * 4}px`,
                          animationDelay: `${(i - 1) * 100}ms`
                        }"
                      />
                    </div>
                    <!-- Play triangle icon -->
                    <svg
                      v-else
                      class="w-4 h-4 text-white ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-stone-800 truncate">{{ voice.name }}</p>
                    <p class="text-xs text-stone-500">{{ voice.originalFileName }}</p>
                  </div>
                  <button
                    class="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    @click="handleDeleteVoice($event, voice)"
                  >
                    <svg v-if="deletingId === (voice.supabaseId || String(voice.id))" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Record Tab -->
            <div v-else-if="modalTab === 'record'" class="flex flex-col items-center py-8">
              <!-- Recording visualization -->
              <div
                class="w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-all"
                :class="isRecording ? 'bg-red-100 animate-pulse' : 'bg-stone-100'"
              >
                <div
                  class="w-24 h-24 rounded-full flex items-center justify-center transition-all"
                  :class="isRecording ? 'bg-red-200' : 'bg-stone-200'"
                >
                  <svg
                    class="w-12 h-12 transition-colors"
                    :class="isRecording ? 'text-red-500' : 'text-stone-400'"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>

              <!-- Recording timer -->
              <div class="text-center mb-6">
                <p class="text-3xl font-bold text-stone-800 font-mono">
                  {{ formatDuration(recordingDuration) }}
                </p>
                <p class="text-sm text-stone-500 mt-1">
                  <template v-if="isRecording">
                    最長 {{ MAX_AUDIO_DURATION }} 秒
                  </template>
                  <template v-else>
                    至少錄製 {{ MIN_AUDIO_DURATION }} 秒
                  </template>
                </p>
              </div>

              <!-- Progress bar -->
              <div v-if="isRecording" class="w-full max-w-xs mb-6">
                <div class="h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-red-500 transition-all duration-1000"
                    :style="{ width: `${recordingProgress}%` }"
                  />
                </div>
              </div>

              <!-- Record button -->
              <button
                v-if="!isProcessing"
                class="px-8 py-4 rounded-full font-medium transition-all flex items-center gap-3"
                :class="isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-stone-800 text-white hover:bg-stone-900'"
                @click="isRecording ? stopRecording() : startRecording()"
              >
                <svg v-if="isRecording" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {{ isRecording ? '停止錄音' : '開始錄音' }}
              </button>

              <!-- Processing state -->
              <div v-if="isProcessing" class="text-center">
                <svg class="animate-spin w-8 h-8 text-stone-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p class="text-sm text-stone-600">{{ uploadProgress }}</p>
              </div>
            </div>

            <!-- Upload Tab -->
            <div v-else-if="modalTab === 'upload'" class="space-y-6">
              <!-- Processing overlay -->
              <div v-if="isProcessing || isCloning" class="flex flex-col items-center justify-center py-12">
                <svg class="animate-spin w-12 h-12 text-stone-600 mb-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p class="text-stone-600 font-medium">{{ uploadProgress || '處理中...' }}</p>
                <p v-if="cloningVoiceName" class="text-sm text-stone-500 mt-1">
                  正在克隆: {{ cloningVoiceName }}
                </p>
              </div>

              <!-- Drag & Drop Zone -->
              <div
                v-else
                class="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
                :class="isDragging ? 'border-stone-500 bg-stone-50' : 'border-stone-300 hover:border-stone-400'"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
                @click="fileInputRef?.click()"
              >
                <svg class="w-12 h-12 mx-auto mb-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p class="font-medium text-stone-700 mb-1">拖曳檔案到這裡</p>
                <p class="text-sm text-stone-500">或點擊選擇檔案</p>
                <p class="text-xs text-stone-400 mt-2">支援 MP3、WAV、M4A、MP4 等格式</p>
                <p class="text-xs text-stone-400">建議長度 {{ MIN_AUDIO_DURATION }}-{{ MAX_AUDIO_DURATION }} 秒</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes audio-wave {
  0%, 100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}

.animate-audio-wave {
  animation: audio-wave 0.4s ease-in-out infinite;
}
</style>
