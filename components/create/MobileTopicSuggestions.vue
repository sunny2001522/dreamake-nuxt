<script setup lang="ts">
import type { SuggestedTopic, MediaPlatform, DbPersona } from '~/types'
import { Gem } from 'lucide-vue-next'

// Channel analysis Token cost
const ANALYSIS_TOKEN_COST = 1

const generationStore = useGenerationStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

const props = defineProps<{
  personaContent?: string
}>()

const emit = defineEmits<{
  personaUpdate: [content: string]
}>()

const transcriptGeneration = useTranscriptGeneration()
const mediaAnalysis = useMediaAnalysis()

const topics = computed(() => transcriptGeneration.suggestedTopics.value)
const isLoadingTopics = computed(() => transcriptGeneration.isLoadingTopics.value)

// Persona modal
const showPersonaModal = ref(false)
const mediaUrl = ref('')
const isAnalyzing = ref(false)
const analysisResult = ref<string | null>(null)

// Saved personas list
const savedPersonas = ref<DbPersona[]>([])
const isLoadingPersonas = ref(false)
const currentPersonaId = ref<string | null>(null)
const expandedPersonaId = ref<string | null>(null)

const hasPersona = computed(() => !!props.personaContent?.trim() || !!analysisResult.value)

// Track selected topic
const selectedTopicId = ref<string | null>(null)

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

// Load saved personas on mount
onMounted(async () => {
  if (authStore.user) {
    await loadSavedPersonas()
  }
})

// Watch for auth changes
watch(() => authStore.user, async (user) => {
  if (user) {
    await loadSavedPersonas()
  } else {
    savedPersonas.value = []
  }
})

async function loadSavedPersonas() {
  if (!authStore.user) return

  try {
    isLoadingPersonas.value = true
    const { getAllPersonas } = usePersonaStorage()
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    savedPersonas.value = await getAllPersonas(userId)
  } catch (err) {
    console.error('Failed to load saved personas:', err)
  } finally {
    isLoadingPersonas.value = false
  }
}

watch(() => props.personaContent, async (content) => {
  if (content && content.trim()) {
    analysisResult.value = content
    await loadTopics(content)
  }
}, { immediate: true })

// Watch for preferences changes and load saved persona
watch(
  () => preferencesStore.preferences?.persona_id,
  async (personaId) => {
    // Only apply if we don't already have a persona set
    if (personaId && !analysisResult.value) {
      try {
        const { getPersonaById } = usePersonaStorage()
        const persona = await getPersonaById(personaId)
        if (persona) {
          analysisResult.value = persona.content
          currentPersonaId.value = persona.id
          emit('personaUpdate', persona.content)
        }
      } catch (err) {
        console.error('Failed to load saved persona:', err)
      }
    } else if (!personaId) {
      currentPersonaId.value = null
    }
  }
)

async function loadTopics(content: string) {
  try {
    await transcriptGeneration.suggestTopics(content)
  } catch (err: any) {
    console.error('Failed to load topics:', err)
    toastStore.error('主題生成失敗', err.message || '請稍後再試')
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
  selectedTopicId.value = topic.id
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

    // 啟動分析任務（背景輪詢）
    await mediaAnalysis.startAnalysis([
      {
        url: mediaUrl.value.trim(),
        platform: urlValidation.value.platform!,
        type: 'channel',
        isValid: true,
      },
    ])

    // 分析已在背景進行，顯示提示並關閉 Modal
    toastStore.success('分析已啟動！', 5000)
    toastStore.info('分析會在背景進行，完成後會自動通知您', 5000)
    showPersonaModal.value = false
    mediaUrl.value = ''
  }
  catch (err: any) {
    console.error('Media analysis failed:', err)
    toastStore.error('啟動分析失敗', err.message || '請稍後再試')
  }
  finally {
    isAnalyzing.value = false
  }
}

async function handleSelectPersona(persona: DbPersona) {
  try {
    // Apply persona
    analysisResult.value = persona.content
    currentPersonaId.value = persona.id
    emit('personaUpdate', persona.content)

    // Update preference
    if (authStore.user) {
      const userId = authStore.authInfo.email || authStore.authInfo.sub
      await preferencesStore.setPersonaPreference(userId, persona.id)

      // Record usage
      const { recordPersonaUsage } = usePersonaStorage()
      await recordPersonaUsage(persona.id)
    }

    showPersonaModal.value = false
    toastStore.success('已套用主題方向')
  } catch (err) {
    console.error('Failed to select persona:', err)
    toastStore.error('套用失敗')
  }
}

async function handleDeletePersona(personaId: string) {
  try {
    const { deletePersona } = usePersonaStorage()
    await deletePersona(personaId)

    // Remove from list
    savedPersonas.value = savedPersonas.value.filter(p => p.id !== personaId)

    // Clear if current persona was deleted
    if (currentPersonaId.value === personaId) {
      currentPersonaId.value = null
      analysisResult.value = null
      emit('personaUpdate', '')

      if (authStore.user) {
        const userId = authStore.authInfo.email || authStore.authInfo.sub
        await preferencesStore.setPersonaPreference(userId, null)
      }
    }

    toastStore.success('已刪除')
  } catch (err) {
    console.error('Failed to delete persona:', err)
    toastStore.error('刪除失敗')
  }
}

// Toggle expanded persona
function toggleExpandPersona(personaId: string, event: Event) {
  event.stopPropagation()
  expandedPersonaId.value = expandedPersonaId.value === personaId ? null : personaId
}

// Parse title from analysis content
function parseAnalysisTitle(analysis: string): string | null {
  const lines = analysis.split('\n')
  const firstLine = lines[0]?.trim()
  if (!firstLine) return null

  // Match pattern: "# ... - 標題名稱"
  const match = firstLine.match(/^#\s+.*?\s+-\s+(.+)$/)
  if (match) {
    return match[1].trim()
  }

  // Fallback: try to find any meaningful text after "-"
  const dashIndex = firstLine.indexOf(' - ')
  if (dashIndex !== -1) {
    return firstLine.substring(dashIndex + 3).trim()
  }

  return null
}
</script>

<template>
  <div>
    <!-- Header row -->
    <div class="flex items-center justify-between mb-1">
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
        </svg>
        <span class="text-xs font-medium text-stone-700">推薦主題</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="hasPersona"
          class="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
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
          重新生成
        </button>
        <button
          class="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
          @click="showPersonaModal = true"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          主題方向
        </button>
      </div>
    </div>

    <!-- Topic chips (horizontal scroll) -->
    <div v-if="isLoadingTopics" class="flex items-center py-2">
      <svg class="animate-spin w-4 h-4 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="text-xs text-stone-500">生成中...</span>
    </div>

    <div v-else class="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
      <button
        v-for="topic in topics"
        :key="topic.id"
        class="flex-shrink-0 px-2.5 py-1 text-xs rounded-full transition-colors"
        :class="selectedTopicId === topic.id
          ? 'bg-purple-100 border border-purple-400 text-purple-700'
          : 'bg-stone-100 border border-stone-300 text-stone-700 hover:bg-stone-200'"
        @click="handleSelectTopic(topic)"
      >
        {{ topic.title }}
      </button>
      <span v-if="!topics.length && !hasPersona" class="text-xs text-stone-400">
        無（請先設定主題方向）
      </span>
    </div>

    <!-- Persona Modal -->
    <Teleport to="body">
      <div
        v-if="showPersonaModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        @click="showPersonaModal = false"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden w-full max-w-md"
          @click.stop
        >
          <div class="px-4 py-3 border-b flex items-center justify-between">
            <h3 class="font-bold text-stone-800">頻道主題方向</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg"
              @click="showPersonaModal = false"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <!-- Saved personas list -->
            <div v-if="savedPersonas.length > 0" class="space-y-2">
              <label class="text-sm font-medium text-stone-600 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                已保存的方向 ({{ savedPersonas.length }})
              </label>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                <div
                  v-for="persona in savedPersonas"
                  :key="persona.id"
                  class="rounded-xl border-2 cursor-pointer transition-all hover:bg-stone-50"
                  :class="currentPersonaId === persona.id ? 'border-purple-500 bg-purple-50' : 'border-stone-200'"
                >
                  <div class="p-3" @click="handleSelectPersona(persona)">
                    <div class="flex items-center justify-between">
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-stone-800 truncate">
                          {{ parseAnalysisTitle(persona.content) || persona.name }}
                        </div>
                        <div class="text-xs text-stone-500 mt-0.5">
                          {{ persona.platforms.join(', ') }} · 已使用 {{ persona.use_count }} 次
                        </div>
                      </div>
                      <div class="flex items-center gap-1 ml-2">
                        <span v-if="currentPersonaId === persona.id" class="text-xs text-purple-600 font-medium">
                          使用中
                        </span>
                        <button
                          class="p-1.5 hover:bg-stone-200 rounded-lg transition-colors"
                          title="展開查看分析內容"
                          @click="toggleExpandPersona(persona.id, $event)"
                        >
                          <svg
                            class="w-4 h-4 text-stone-400 transition-transform duration-200"
                            :class="{ 'rotate-180': expandedPersonaId === persona.id }"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          class="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                          @click.stop="handleDeletePersona(persona.id)"
                        >
                          <svg class="w-4 h-4 text-stone-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Expanded content -->
                  <Transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-96 opacity-100"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="max-h-96 opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div
                      v-if="expandedPersonaId === persona.id"
                      class="px-3 pb-3 overflow-hidden"
                    >
                      <div class="pt-2 border-t border-stone-200">
                        <pre class="text-xs text-stone-600 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">{{ persona.content }}</pre>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Loading state -->
            <div v-else-if="isLoadingPersonas" class="flex items-center justify-center py-4">
              <svg class="animate-spin w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>

            <!-- Divider -->
            <div v-if="savedPersonas.length > 0" class="border-t border-stone-200 pt-4">
              <label class="text-sm font-medium text-stone-600 flex items-center gap-2 mb-2">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                新增方向
              </label>
            </div>

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
              />
              <p v-if="urlValidation.error && mediaUrl.trim()" class="mt-1 text-xs text-red-500">
                {{ urlValidation.error }}
              </p>
              
            </div>

            <div class="flex flex-wrap gap-2">
              <span class="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-full">YouTube</span>
              <span class="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-full">Twitch</span>
              <span class="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full">Bilibili</span>
              <span class="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-full">TikTok</span>
            </div>
          </div>

          <div class="px-4 py-3 border-t flex justify-end gap-2">
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
              @click="showPersonaModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
              :disabled="!urlValidation.isValid || isAnalyzing"
              @click="handleAnalyzeMedia"
            >
              <svg v-if="isAnalyzing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ isAnalyzing ? '分析中...' : '開始分析' }}
              <span v-if="!isAnalyzing" class="flex items-center gap-0.5 text-white/80">
                <Gem class="w-3 h-3" />{{ ANALYSIS_TOKEN_COST }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
