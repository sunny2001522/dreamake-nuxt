<script setup lang="ts">
import type { MediaPlatform } from '~/types'
import { Gem } from 'lucide-vue-next'

// Channel analysis Token cost (shown in UI, actual deduction happens on completion)
const ANALYSIS_TOKEN_COST = 1

const toastStore = useToastStore()
const mediaAnalysis = useMediaAnalysis()
const pendingStore = usePendingAnalysesStore()

// Modal state
const showModal = ref(false)
const mediaUrl = ref('')
const isStartingAnalysis = ref(false) // 只用於「開始分析」按鈕的載入狀態
const analysisResult = ref<string | null>(null)
const analysisPlatform = ref<MediaPlatform | null>(null)

// 追蹤當前的分析任務
const currentJobId = ref<string | null>(null)

// Emits for topic suggestions
const emit = defineEmits<{
  personaUpdate: [content: string]
}>()

// 監聽 store 中的完成事件
watch(
  () => pendingStore.analyses,
  (analyses) => {
    // 檢查是否有我們追蹤的任務完成了
    if (currentJobId.value) {
      const myAnalysis = analyses.find(a => a.jobId === currentJobId.value)
      if (myAnalysis?.status === 'completed' && myAnalysis.result) {
        // 任務完成，更新 UI
        analysisResult.value = myAnalysis.result
        analysisPlatform.value = myAnalysis.platforms[0] || null
        emit('personaUpdate', myAnalysis.result)
        currentJobId.value = null
      }
    }
  },
  { deep: true }
)

// Validate URL and detect platform
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
  }
  catch {
    return { isValid: false, platform: null, error: '請輸入有效的網址' }
  }
})

const platformLabels: Record<MediaPlatform, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  bilibili: 'Bilibili',
  tiktok: 'TikTok',
  podcast: 'Podcast',
  other: '其他',
}

// 是否有正在進行的分析（來自 store）
const hasOngoingAnalysis = computed(() => pendingStore.pendingCount > 0)

function openModal() {
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  mediaUrl.value = ''
}

async function handleAnalyze() {
  if (!urlValidation.value.isValid) {
    toastStore.warning(urlValidation.value.error || '請輸入有效的媒體網址')
    return
  }

  try {
    isStartingAnalysis.value = true
    analysisPlatform.value = urlValidation.value.platform

    // 啟動分析任務（存入數據庫，由背景輪詢處理）
    const { jobId } = await mediaAnalysis.startAnalysis([
      {
        url: mediaUrl.value.trim(),
        platform: urlValidation.value.platform!,
        type: 'channel',
        isValid: true,
      },
    ])

    // 記錄當前任務 ID
    currentJobId.value = jobId

    // 分析已啟動，顯示提示並關閉 Modal
    toastStore.success('分析已啟動！', 5000)
    toastStore.info('分析會在背景進行，完成後會自動通知您', 5000)
    closeModal()
  }
  catch (err: any) {
    console.error('Media analysis failed:', err)
    toastStore.error('啟動分析失敗', err.message || '請稍後再試')
  }
  finally {
    isStartingAnalysis.value = false
  }
}

function handleClearPersona() {
  analysisResult.value = null
  analysisPlatform.value = null
  currentJobId.value = null
  emit('personaUpdate', '')
}
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">創作風格</label>
      <span class="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">可選</span>
    </div>

    <!-- Has persona result -->
    <div v-if="analysisResult" class="space-y-3">
      <div class="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
        <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-green-700">已分析</p>
          <p v-if="analysisPlatform" class="text-xs text-green-600">
            {{ platformLabels[analysisPlatform] }}
          </p>
        </div>
        <button
          class="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          @click="handleClearPersona"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Preview of analysis -->
      <div class="p-3 bg-stone-50 rounded-xl">
        <p class="text-xs text-stone-500 line-clamp-3">{{ analysisResult }}</p>
      </div>

      <button
        class="w-full text-sm text-purple-600 hover:text-purple-700"
        @click="openModal"
      >
        重新分析
      </button>
    </div>

    <!-- No persona yet -->
    <template v-else>
      <p class="text-sm text-stone-500 mb-3">
        輸入 YouTube 頻道或社群媒體連結，AI 會分析創作者風格並生成符合其特色的腳本。
      </p>

      <button
        class="w-full p-3 border border-stone-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-colors text-center text-sm text-stone-600"
        @click="openModal"
      >
        + 設定創作風格
      </button>
    </template>

    <!-- Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="closeModal"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[500px] max-w-[90vw]"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">讓 AI 學習你的風格</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="closeModal"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-4">
            <!-- 輸入區域 -->
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
                :disabled="isStartingAnalysis"
                @keyup.enter="handleAnalyze"
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
                AI 會學習你的說話方式、用詞習慣，幫你寫出符合你風格的腳本。
                分析會在背景進行，完成後會自動通知您並扣除 {{ ANALYSIS_TOKEN_COST }} 點數。
              </p>
            </div>

            <!-- 進行中的分析提示 -->
            <div v-if="hasOngoingAnalysis" class="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <div class="flex items-center gap-2">
                <div class="relative">
                  <div class="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                </div>
                <span class="text-sm text-purple-700">
                  目前有 {{ pendingStore.pendingCount }} 個分析正在進行中
                </span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-4 py-3 border-t border-stone-200 flex justify-end gap-2">
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="closeModal"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="!urlValidation.isValid || isStartingAnalysis"
              @click="handleAnalyze"
            >
              <svg v-if="isStartingAnalysis" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {{ isStartingAnalysis ? '啟動中...' : '開始分析' }}
              <span v-if="!isStartingAnalysis" class="flex items-center gap-0.5 text-white/80">
                <Gem class="w-3 h-3" />{{ ANALYSIS_TOKEN_COST }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
