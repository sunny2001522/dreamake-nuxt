<script setup lang="ts">
import {
  Mic,
  RefreshCw,
  Trash2,
  AlertTriangle,
  X,
  Mic2,
} from 'lucide-vue-next'
import type { ClonedVoice } from '~/types/admin'

const authStore = useAuthStore()
const toastStore = useToastStore()

const GHOST_VOICES_KEY = 'topmediai_ghost_voices'

// State
const voices = ref<ClonedVoice[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selectedIds = ref<Set<string>>(new Set())
const deleting = ref(false)
const showConfirm = ref(false)
const ghostVoiceIds = ref<Set<string>>(new Set())

// Helper to get ghost voice IDs from localStorage
function getGhostVoiceIds(): Set<string> {
  if (import.meta.server) return new Set()
  try {
    const stored = localStorage.getItem(GHOST_VOICES_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

// Helper to save ghost voice IDs to localStorage
function saveGhostVoiceIds(ids: Set<string>) {
  if (import.meta.server) return
  try {
    localStorage.setItem(GHOST_VOICES_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // Ignore storage errors
  }
}

// Add deleted voice IDs to ghost list
function addToGhostList(speakerIds: string[]) {
  const current = getGhostVoiceIds()
  speakerIds.forEach(id => current.add(id))
  saveGhostVoiceIds(current)
  ghostVoiceIds.value = current
}

// Fetch voices
async function fetchVoices() {
  loading.value = true
  error.value = null
  selectedIds.value = new Set()

  try {
    const data = await $fetch<{ voices: ClonedVoice[] }>('/api/admin/voices', {
      headers: {
        'x-user-email': authStore.authInfo.email || '',
      },
    })

    const allVoices = data.voices || []

    // Filter out known ghost voices and voices with "ghost" in their ID or name
    const currentGhostIds = getGhostVoiceIds()
    const filteredVoices = allVoices.filter(v => {
      const id = (v.speaker_id || '').toLowerCase()
      const name = (v.speaker_name || '').toLowerCase()
      const isGhost = id.includes('ghost') || name.includes('ghost')
      const isKnownGhost = currentGhostIds.has(v.speaker_id)
      return !isGhost && !isKnownGhost
    })

    console.log('[VoicesManagement] Total voices:', allVoices.length, 'Filtered:', filteredVoices.length, 'Ghost list:', currentGhostIds.size)

    voices.value = filteredVoices
  } catch (err: any) {
    console.error('Failed to fetch voices:', err)
    error.value = err.message || 'Failed to fetch voices'
  } finally {
    loading.value = false
  }
}

// Toggle selection
function toggleSelect(speakerId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(speakerId)) {
    next.delete(speakerId)
  } else {
    next.add(speakerId)
  }
  selectedIds.value = next
}

// Toggle select all
function toggleSelectAll() {
  if (selectedIds.value.size === voices.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(voices.value.map((v) => v.speaker_id))
  }
}

// Handle delete
async function handleDelete() {
  if (selectedIds.value.size === 0) return

  deleting.value = true
  showConfirm.value = false

  const idsToDelete = Array.from(selectedIds.value)
  const results: { success: string[]; failed: string[] } = { success: [], failed: [] }

  // Delete each voice individually
  for (const speakerId of idsToDelete) {
    try {
      await $fetch(`/api/admin/voices/${speakerId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': authStore.authInfo.email || '',
        },
      })
      results.success.push(speakerId)
    } catch (err: any) {
      console.error(`Failed to delete ${speakerId}:`, err)
      results.failed.push(speakerId)
    }
  }

  // Add successfully deleted voices to ghost list
  // This ensures they won't appear even if API still returns them
  if (results.success.length > 0) {
    addToGhostList(results.success)
  }

  if (results.failed.length > 0) {
    error.value = `部分刪除失敗: ${results.failed.length} 個`
  } else {
    toastStore.success(`成功刪除 ${results.success.length} 個聲音`)
  }

  deleting.value = false
  await fetchVoices()
}

// Initialize
onMounted(() => {
  ghostVoiceIds.value = getGhostVoiceIds()
  fetchVoices()
})
</script>

<template>
  <div class="bg-white rounded-xl border border-stone-200 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-stone-100">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <Mic class="w-5 h-5" />
        </div>
        <div>
          <h2 class="font-semibold text-stone-800">克隆聲音管理</h2>
          <p class="text-sm text-stone-500">
            {{ loading ? '載入中...' : `共 ${voices.length} 個聲音` }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="selectedIds.size > 0"
          @click="showConfirm = true"
          :disabled="deleting"
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <Trash2 class="w-4 h-4" />
          刪除 ({{ selectedIds.size }})
        </button>
        <button
          @click="fetchVoices"
          :disabled="loading"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:border-pink-400 hover:text-pink-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
          刷新
        </button>
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
    >
      <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0" />
      <span class="text-sm text-red-700">{{ error }}</span>
      <button
        @click="error = null"
        class="ml-auto text-red-500 hover:text-red-700"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-6">
      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
          <div class="w-5 h-5 bg-stone-200 rounded"></div>
          <div class="flex-1">
            <div class="h-4 w-32 bg-stone-200 rounded mb-2"></div>
            <div class="h-3 w-48 bg-stone-100 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="voices.length === 0" class="text-center py-12">
        <Mic2 class="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p class="text-stone-500">尚無克隆聲音</p>
      </div>

      <!-- Voices list -->
      <div v-else class="space-y-2">
        <!-- Select all header -->
        <div class="flex items-center gap-3 px-4 py-2 text-sm text-stone-500">
          <input
            type="checkbox"
            :checked="selectedIds.size === voices.length && voices.length > 0"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded border-stone-300 text-pink-500 focus:ring-pink-400"
          />
          <span>全選</span>
        </div>

        <!-- Voice items -->
        <div
          v-for="voice in voices"
          :key="voice.speaker_id"
          class="flex items-center gap-4 p-4 rounded-lg transition-colors"
          :class="selectedIds.has(voice.speaker_id) ? 'bg-pink-50' : 'bg-stone-50 hover:bg-stone-100'"
        >
          <input
            type="checkbox"
            :checked="selectedIds.has(voice.speaker_id)"
            @change="toggleSelect(voice.speaker_id)"
            class="w-4 h-4 rounded border-stone-300 text-pink-500 focus:ring-pink-400"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-stone-800 truncate">
                {{ voice.speaker_name || '未命名' }}
              </span>
              <span
                v-if="voice.model"
                class="text-xs bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded"
              >
                {{ voice.model }}
              </span>
            </div>
            <p class="text-xs text-stone-500 font-mono truncate">
              {{ voice.speaker_id }}
            </p>
          </div>
          <button
            @click="selectedIds = new Set([voice.speaker_id]); showConfirm = true"
            class="p-2 text-stone-400 hover:text-red-500 transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Note -->
    <div class="px-6 pb-4">
      <p class="text-xs text-stone-400">
        注意：TopMediai API 可能存在同步延遲，刪除後聲音仍可能短暫顯示
      </p>
    </div>

    <!-- Delete confirmation modal -->
    <CommonModal v-model="showConfirm" title="確認刪除">
      <p class="text-stone-600">
        確定要刪除選中的 {{ selectedIds.size }} 個聲音嗎？此操作無法復原。
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showConfirm = false"
            class="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            取消
          </button>
          <button
            @click="handleDelete"
            :disabled="deleting"
            class="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          >
            {{ deleting ? '刪除中...' : '確認刪除' }}
          </button>
        </div>
      </template>
    </CommonModal>
  </div>
</template>
