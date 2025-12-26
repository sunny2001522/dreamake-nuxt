<script setup lang="ts">
import type { GenerationRecord } from '~/types'

const authStore = useAuthStore()
const router = useRouter()
const { getAllVideos, deleteVideo } = useVideoStorage()

const videos = ref<GenerationRecord[]>([])
const isLoading = ref(false)
const selectedItems = ref<Set<string>>(new Set())
const isSelectMode = ref(false)

// Toast state
const toast = ref<{
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
} | null>(null)

async function loadVideos() {
  if (!authStore.user) return

  isLoading.value = true
  try {
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    const dbVideos = await getAllVideos(userId)

    videos.value = dbVideos.map(v => ({
      id: v.id,
      thumbnailUrl: v.thumbnail_url || v.avatar_preview || undefined,
      transcript: v.transcript,
      aspectRatio: v.aspect_ratio,
      duration: v.duration || 0,
      createdAt: new Date(v.created_at),
      status: v.status,
      audioUrl: v.audio_url || undefined,
      videoUrl: v.video_url || undefined,
      speakerId: v.speaker_id || undefined,
      title: v.title || undefined,
      subtitleStyle: v.subtitle_style,
      avatarPreview: v.avatar_preview || undefined,
      voicePreview: v.voice_preview || undefined,
    }))
  } catch (err) {
    console.error('Failed to load videos:', err)
    toast.value = {
      type: 'error',
      title: '載入失敗',
      description: '無法載入生成紀錄',
    }
  } finally {
    isLoading.value = false
  }
}

// Group history by date
function groupHistoryByDate() {
  const groups: { [key: string]: GenerationRecord[] } = {}
  videos.value.forEach((item) => {
    const date = new Date(item.createdAt)
    const dateKey = date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(item)
  })
  return groups
}

const groupedHistory = computed(() => groupHistoryByDate())

// Toggle item selection
function toggleItemSelection(id: string) {
  const newSet = new Set(selectedItems.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedItems.value = newSet
}

// Select all items
function selectAllItems() {
  if (selectedItems.value.size === videos.value.length) {
    selectedItems.value = new Set()
  } else {
    selectedItems.value = new Set(videos.value.map(item => item.id))
  }
}

// Handle batch download
async function handleBatchDownload() {
  if (selectedItems.value.size === 0) {
    toast.value = { type: 'error', title: '未選擇項目', description: '請勾選要下載的歷史記錄' }
    return
  }

  toast.value = {
    type: 'info',
    title: '批量下載中',
    description: `正在下載 ${selectedItems.value.size} 個項目`,
  }

  for (const id of selectedItems.value) {
    const item = videos.value.find(h => h.id === id)
    if (item) {
      await downloadItem(item)
    }
  }

  setTimeout(() => {
    selectedItems.value = new Set()
    isSelectMode.value = false
  }, 1000)
}

// Handle batch delete
async function handleBatchDelete() {
  if (selectedItems.value.size === 0) {
    toast.value = { type: 'error', title: '未選擇項目', description: '請勾選要刪除的歷史記錄' }
    return
  }

  try {
    for (const id of selectedItems.value) {
      await deleteVideo(id)
    }

    videos.value = videos.value.filter(h => !selectedItems.value.has(h.id))
    selectedItems.value = new Set()
    isSelectMode.value = false
  } catch (error) {
    console.error('Batch delete failed:', error)
    toast.value = {
      type: 'error',
      title: '刪除失敗',
      description: '請稍後再試',
    }
  }
}

// Handle delete single item
async function handleDeleteItem(item: GenerationRecord) {
  try {
    await deleteVideo(item.id)
    videos.value = videos.value.filter(h => h.id !== item.id)
  } catch (error) {
    console.error('Failed to delete history:', error)
    toast.value = {
      type: 'error',
      title: '刪除失敗',
      description: '請稍後再試',
    }
  }
}

// Handle item click - navigate to create page with item loaded
function handleItemClick(item: GenerationRecord) {
  if (isSelectMode.value) {
    toggleItemSelection(item.id)
  } else {
    sessionStorage.setItem('loadHistoryItem', JSON.stringify(item))
    router.push('/create')
  }
}

// Handle regenerate - navigate to create page and trigger generation
function handleRegenerate(item: GenerationRecord) {
  sessionStorage.setItem('loadHistoryItem', JSON.stringify(item))
  sessionStorage.setItem('triggerRegenerate', 'true')
  router.push('/create')
}

// Download single item
async function downloadItem(item: GenerationRecord) {
  const url = item.videoUrl || item.audioUrl
  if (!url) return

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `${item.title || 'video'}-${Date.now()}.${item.videoUrl ? 'mp4' : 'mp3'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Download failed:', error)
    toast.value = {
      type: 'error',
      title: '下載失敗',
      description: '請稍後再試',
    }
  }
}

// Handle single item download
function handleSingleDownload(item: GenerationRecord) {
  downloadItem(item)
}

// Cancel select mode
function cancelSelectMode() {
  isSelectMode.value = false
  selectedItems.value = new Set()
}

// Format duration
function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

onMounted(loadVideos)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Toast Notification -->
    <div
      v-if="toast"
      class="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg"
      :class="{
        'bg-green-500 text-white': toast.type === 'success',
        'bg-red-500 text-white': toast.type === 'error',
        'bg-blue-500 text-white': toast.type === 'info',
        'bg-yellow-500 text-white': toast.type === 'warning',
      }"
    >
      <div class="font-medium">{{ toast.title }}</div>
      <div v-if="toast.description" class="text-sm opacity-90">{{ toast.description }}</div>
    </div>

    <!-- Sub Header with actions -->
    <div class="bg-white border-b border-stone-200 px-4 py-3 shrink-0">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <h1 class="text-lg font-bold text-stone-800">我的影片</h1>
        <div class="flex items-center gap-2">
          <template v-if="isSelectMode">
            <button
              @click="selectAllItems"
              class="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 transition-colors"
            >
              {{ selectedItems.size === videos.length ? '取消全選' : '全選' }}
            </button>
            <button
              @click="handleBatchDownload"
              :disabled="selectedItems.size === 0"
              class="px-3 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下載 ({{ selectedItems.size }})
            </button>
            <button
              @click="handleBatchDelete"
              :disabled="selectedItems.size === 0"
              class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              刪除 ({{ selectedItems.size }})
            </button>
            <button
              @click="cancelSelectMode"
              class="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              取消
            </button>
          </template>
          <template v-else>
            <button
              @click="isSelectMode = true"
              class="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              選擇
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" />
    </div>

    <!-- Empty State -->
    <div v-else-if="videos.length === 0" class="flex-1 flex flex-col items-center justify-center text-stone-400">
      <svg class="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p>尚無生成紀錄</p>
      <button
        @click="navigateTo('/create')"
        class="mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
      >
        開始生成
      </button>
    </div>

    <!-- History List by Date -->
    <div v-else class="flex-1 overflow-y-auto p-4 pb-8">
      <div class="space-y-6 max-w-6xl mx-auto">
        <div v-for="(items, date) in groupedHistory" :key="date">
          <h2 class="text-sm font-bold text-stone-500 mb-3 py-2">{{ date }}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <div
              v-for="item in items"
              :key="item.id"
              class="relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all"
              :class="selectedItems.has(item.id)
                ? 'border-stone-800 ring-2 ring-stone-400/30'
                : 'border-transparent hover:border-stone-300'"
              @click="handleItemClick(item)"
            >
              <!-- Thumbnail -->
              <div class="aspect-[9/16] bg-stone-200 flex items-center justify-center relative overflow-hidden">
                <img
                  v-if="item.avatarPreview || item.thumbnailUrl"
                  :src="item.avatarPreview || item.thumbnailUrl"
                  alt="thumbnail"
                  class="w-full h-full object-cover"
                />
                <svg v-else class="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>

                <!-- Selection checkbox -->
                <div v-if="isSelectMode" class="absolute top-2 right-2 z-10">
                  <div v-if="selectedItems.has(item.id)" class="w-6 h-6 bg-stone-800 rounded-full flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div v-else class="w-6 h-6 bg-white/80 border-2 border-stone-300 rounded-full" />
                </div>

                <!-- Delete button - always visible when not in select mode -->
                <button
                  v-if="!isSelectMode"
                  @click.stop="handleDeleteItem(item)"
                  class="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-500 rounded-full transition-all"
                  title="刪除"
                >
                  <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <!-- Duration badge -->
                <span
                  v-if="item.duration > 0"
                  class="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded"
                >
                  {{ formatDuration(item.duration) }}
                </span>

                <!-- Media type badge -->
                <div class="absolute bottom-1 left-1 p-1 bg-black/60 rounded">
                  <svg v-if="item.videoUrl" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg v-else-if="item.audioUrl" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>

                <!-- Failed status badge -->
                <div
                  v-if="!item.audioUrl && !item.videoUrl && item.status !== 'processing'"
                  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-black/70 px-3 py-2 rounded-lg"
                >
                  <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-[10px] text-red-400 font-medium">生成失敗</span>
                </div>

                <!-- Processing status badge -->
                <div
                  v-if="item.status === 'processing'"
                  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-black/70 px-3 py-2 rounded-lg"
                >
                  <div class="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  <span class="text-[10px] text-yellow-400 font-medium">處理中</span>
                </div>

                <!-- Hover overlay with actions (when not in select mode) -->
                <div
                  v-if="!isSelectMode"
                  class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3"
                >
                  <button
                    @click.stop="handleRegenerate(item)"
                    class="p-2.5 bg-white rounded-full hover:bg-stone-100 transition-colors shadow-lg"
                    title="重新生成"
                  >
                    <svg class="w-5 h-5 text-stone-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    @click.stop="handleSingleDownload(item)"
                    class="p-2.5 bg-white rounded-full hover:bg-stone-100 transition-colors shadow-lg"
                    title="下載"
                  >
                    <svg class="w-5 h-5 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Caption -->
              <div class="p-2 bg-white">
                <p class="text-xs font-medium text-stone-700 truncate">
                  {{ item.title || (item.transcript.substring(0, 15) + (item.transcript.length > 15 ? '...' : '')) }}
                </p>
                <div class="flex items-center justify-between mt-0.5">
                  <p class="text-[10px] text-stone-400">
                    {{ new Date(item.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
                  </p>
                  <span
                    v-if="!item.audioUrl && !item.videoUrl && item.status !== 'processing'"
                    class="text-[10px] text-red-500 font-medium"
                  >
                    失敗
                  </span>
                  <span
                    v-if="item.status === 'processing'"
                    class="text-[10px] text-yellow-600 font-medium"
                  >
                    處理中
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
