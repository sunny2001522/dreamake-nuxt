<script setup lang="ts">
import type { SuggestedTopic, MediaPlatform } from '~/types'

const generationStore = useGenerationStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

// Props for persona content
const props = defineProps<{
  personaContent?: string
}>()

const emit = defineEmits<{
  personaUpdate: [content: string]
}>()

// Transcript generation composable
const transcriptGeneration = useTranscriptGeneration()
const mediaAnalysis = useMediaAnalysis()

const maxLength = 500
const charCount = computed(() => draft.value.transcript.length)
const isOverLimit = computed(() => charCount.value > maxLength)

// AI generation modal
const showAIModal = ref(false)
const aiTopic = ref('')
const isGenerating = computed(() => transcriptGeneration.isGenerating.value)

// Persona modal
const showPersonaModal = ref(false)
const mediaUrl = ref('')
const isAnalyzing = ref(false)
const analysisResult = ref<string | null>(null)
const analysisPlatform = ref<MediaPlatform | null>(null)

// Topic suggestions
const topics = computed(() => transcriptGeneration.suggestedTopics.value)
const isLoadingTopics = computed(() => transcriptGeneration.isLoadingTopics.value)
const hasPersona = computed(() => !!props.personaContent?.trim() || !!analysisResult.value)

// Platform labels
const platformLabels: Record<MediaPlatform, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  bilibili: 'Bilibili',
  tiktok: 'TikTok',
  podcast: 'Podcast',
  other: '其他',
}

// URL validation
const urlValidation = computed(() => {
  if (!mediaUrl.value.trim()) {
    return { isValid: false, platform: null as MediaPlatform | null, error: null }
  }

  try {
    const url = new URL(mediaUrl.value.trim())
    const hostname = url.hostname.toLowerCase()

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return { isValid: true, platform: 'youtube' as MediaPlatform, error: null }
    }
    if (hostname.includes('twitch.tv')) {
      return { isValid: true, platform: 'twitch' as MediaPlatform, error: null }
    }
    if (hostname.includes('bilibili.com')) {
      return { isValid: true, platform: 'bilibili' as MediaPlatform, error: null }
    }
    if (hostname.includes('tiktok.com')) {
      return { isValid: true, platform: 'tiktok' as MediaPlatform, error: null }
    }

    return { isValid: false, platform: null, error: '不支援此平台' }
  } catch {
    return { isValid: false, platform: null, error: '請輸入有效的網址' }
  }
})

// Watch for persona content changes to load topics
watch(() => props.personaContent, async (content) => {
  if (content && content.trim()) {
    analysisResult.value = content
    await loadTopics(content)
  }
}, { immediate: true })

function handleInput(value: string) {
  generationStore.updateDraft({ transcript: value })
}

async function handleGenerateScript() {
  if (!aiTopic.value.trim()) {
    toastStore.warning('請輸入主題')
    return
  }

  try {
    const transcript = await transcriptGeneration.generateTranscript(aiTopic.value.trim())
    generationStore.updateDraft({ transcript })
    showAIModal.value = false
    aiTopic.value = ''
    toastStore.success('腳本生成完成！')
  } catch (err: any) {
    console.error('Failed to generate transcript:', err)
    toastStore.error('生成失敗', err.message || '請稍後再試')
  }
}

async function handleGenerateTitle() {
  if (!draft.value.transcript.trim()) {
    toastStore.warning('請先輸入腳本內容')
    return
  }

  try {
    const title = await transcriptGeneration.generateTitle(draft.value.transcript)
    generationStore.updateDraft({ title })
    toastStore.success('標題生成完成！')
  } catch (err: any) {
    console.error('Failed to generate title:', err)
    toastStore.error('標題生成失敗', err.message || '請稍後再試')
  }
}

async function loadTopics(content: string) {
  try {
    await transcriptGeneration.suggestTopics(content)
  } catch (err) {
    console.error('Failed to load topics:', err)
  }
}

async function handleRefreshTopics() {
  const content = analysisResult.value || props.personaContent
  if (!content?.trim()) {
    toastStore.warning('請先設定頻道風格')
    return
  }
  await loadTopics(content)
}

async function handleSelectTopic(topic: SuggestedTopic) {
  try {
    toastStore.info('正在生成腳本...')
    const transcript = await transcriptGeneration.generateTranscript(topic.title)
    generationStore.updateDraft({ transcript, title: topic.title })
    toastStore.success('腳本生成完成！')
  } catch (err: any) {
    console.error('Failed to generate transcript:', err)
    toastStore.error('生成失敗', err.message || '請稍後再試')
  }
}

async function handleAnalyzeMedia() {
  if (!urlValidation.value.isValid) {
    toastStore.warning(urlValidation.value.error || '請輸入有效的媒體網址')
    return
  }

  try {
    isAnalyzing.value = true
    analysisPlatform.value = urlValidation.value.platform

    const result = await mediaAnalysis.startAnalysis([
      {
        url: mediaUrl.value.trim(),
        platform: urlValidation.value.platform!,
        type: 'channel',
        isValid: true,
      },
    ])

    if (result) {
      analysisResult.value = result
      emit('personaUpdate', result)
      toastStore.success('分析完成！')
      showPersonaModal.value = false
      mediaUrl.value = ''
    }
  } catch (err: any) {
    console.error('Media analysis failed:', err)
    toastStore.error('分析失敗', err.message || '請稍後再試')
  } finally {
    isAnalyzing.value = false
  }
}

function handleClearPersona() {
  analysisResult.value = null
  analysisPlatform.value = null
  emit('personaUpdate', '')
}

function openAIModal() {
  showAIModal.value = true
}

function closeAIModal() {
  showAIModal.value = false
  aiTopic.value = ''
}
</script>

<template>
  <div class="card p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <label class="font-bold text-stone-800">4. 內容逐字稿</label>
      <span
        :class="[
          'text-xs',
          isOverLimit ? 'text-red-500' : 'text-stone-400',
        ]"
      >
        {{ charCount }} / {{ maxLength }}
      </span>
    </div>

    <!-- Topic Suggestions Section -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-stone-600">推薦主題</span>
        <div class="flex items-center gap-2">
          <!-- Refresh button -->
          <button
            v-if="hasPersona"
            class="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
            :disabled="isLoadingTopics"
            @click="handleRefreshTopics"
          >
            <svg
              class="w-3.5 h-3.5"
              :class="{ 'animate-spin': isLoadingTopics }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <!-- Persona settings button -->
          <button
            class="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
            @click="showPersonaModal = true"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {{ hasPersona ? '主題方向' : '設定主題' }}
          </button>
        </div>
      </div>

      <!-- Topic list or empty state -->
      <div v-if="isLoadingTopics" class="flex items-center justify-center py-4">
        <svg class="animate-spin w-5 h-5 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span class="text-sm text-stone-500">正在生成推薦主題...</span>
      </div>

      <div v-else-if="topics.length > 0" class="flex flex-wrap gap-2">
        <button
          v-for="topic in topics"
          :key="topic.id"
          class="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
          @click="handleSelectTopic(topic)"
        >
          {{ topic.title }}
        </button>
      </div>

      <p v-else class="text-sm text-stone-400">
        無（請先設定頻道風格）
      </p>

      <!-- Persona status -->
      <div v-if="hasPersona" class="mt-2 flex items-center gap-2">
        <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          已設定{{ analysisPlatform ? ` (${platformLabels[analysisPlatform]})` : '' }}
        </span>
        <button
          class="text-xs text-stone-400 hover:text-red-500"
          @click="handleClearPersona"
        >
          清除
        </button>
      </div>
    </div>

    <!-- Title input -->
    <div class="mb-3">
      <div class="flex items-center gap-2">
        <input
          :value="draft.title"
          type="text"
          placeholder="標題（可選）"
          class="flex-1 px-3 py-2 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          @input="generationStore.updateDraft({ title: ($event.target as HTMLInputElement).value })"
        />
        <button
          class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
          title="AI 生成標題"
          :disabled="!draft.transcript.trim()"
          @click="handleGenerateTitle"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Transcript textarea -->
    <textarea
      :value="draft.transcript"
      placeholder="輸入影片主題或逐字稿"
      class="w-full h-32 p-4 text-stone-800 bg-stone-50 border border-stone-200 rounded-xl resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
      @input="handleInput(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Action buttons -->
    <div class="mt-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          語音輸入
        </button>
      </div>

      <button
        class="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        @click="openAIModal"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        AI 生成
      </button>
    </div>

    <!-- Persona Modal -->
    <Teleport to="body">
      <div
        v-if="showPersonaModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="showPersonaModal = false"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[500px] max-w-[90vw]"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">頻道主題方向</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="showPersonaModal = false"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2">媒體網址</label>
              <input
                v-model="mediaUrl"
                type="url"
                placeholder="輸入 YouTube 頻道或影片網址..."
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                :class="urlValidation.error && mediaUrl.trim()
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-purple-500'"
                @keyup.enter="handleAnalyzeMedia"
              />
              <p v-if="urlValidation.error && mediaUrl.trim()" class="mt-1 text-xs text-red-500">
                {{ urlValidation.error }}
              </p>
              <p v-else-if="urlValidation.platform" class="mt-1 text-xs text-green-600">
                已識別平台：{{ platformLabels[urlValidation.platform] }}
              </p>
            </div>

            <!-- Supported platforms -->
            <div>
              <p class="text-xs text-stone-500 mb-2">支援的平台：</p>
              <div class="flex flex-wrap gap-2">
                <span class="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-full">YouTube</span>
                <span class="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-full">Twitch</span>
                <span class="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full">Bilibili</span>
                <span class="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-full">TikTok</span>
              </div>
            </div>

            <div class="p-3 bg-stone-50 rounded-xl">
              <p class="text-xs text-stone-500">
                AI 會分析頻道內容、影片風格、說話方式等特徵，並根據分析結果推薦適合的主題和生成相應風格的腳本。
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-4 py-3 border-t border-stone-200 flex justify-end gap-2">
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="showPersonaModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="!urlValidation.isValid || isAnalyzing"
              @click="handleAnalyzeMedia"
            >
              <svg v-if="isAnalyzing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {{ isAnalyzing ? '分析中...' : '開始分析' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- AI Generation Modal -->
    <Teleport to="body">
      <div
        v-if="showAIModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="closeAIModal"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[500px] max-w-[90vw]"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">AI 生成腳本</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="closeAIModal"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2">主題</label>
              <input
                v-model="aiTopic"
                type="text"
                placeholder="例如：如何提升工作效率"
                class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                @keyup.enter="handleGenerateScript"
              />
            </div>

            <p class="text-sm text-stone-500">
              AI 會根據主題生成適合短影片的腳本內容。
            </p>
          </div>

          <!-- Footer -->
          <div class="px-4 py-3 border-t border-stone-200 flex justify-end gap-2">
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="closeAIModal"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="!aiTopic.trim() || isGenerating"
              @click="handleGenerateScript"
            >
              <svg v-if="isGenerating" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {{ isGenerating ? '生成中...' : '生成腳本' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
