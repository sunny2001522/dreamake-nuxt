<script setup lang="ts">
import type { SuggestedTopic } from '~/types'

const generationStore = useGenerationStore()
const toastStore = useToastStore()

// Transcript generation composable
const transcriptGeneration = useTranscriptGeneration()

const topics = computed(() => transcriptGeneration.suggestedTopics.value)
const isLoading = computed(() => transcriptGeneration.isLoadingTopics.value)

// Track selected topic
const selectedTopicId = ref<string | null>(null)

// Props for persona content
const props = defineProps<{
  personaContent?: string
}>()

// Load topics when persona content changes
watch(() => props.personaContent, async (content) => {
  if (content && content.trim()) {
    await loadTopics(content)
  }
}, { immediate: true })

async function loadTopics(content: string) {
  try {
    await transcriptGeneration.suggestTopics(content)
  } catch (err) {
    console.error('Failed to load topics:', err)
  }
}

async function handleRefresh() {
  if (!props.personaContent?.trim()) {
    toastStore.warning('請先設定 AI 人格')
    return
  }

  await loadTopics(props.personaContent)
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
</script>

<template>
  <div v-if="topics.length > 0 || isLoading" class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">推薦主題</label>
      <button
        class="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <svg
          class="w-3.5 h-3.5"
          :class="{ 'animate-spin': isLoading }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        重新整理
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-4">
      <svg class="animate-spin w-5 h-5 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="text-sm text-stone-500">正在生成推薦主題...</span>
    </div>

    <!-- Topics list -->
    <div v-else class="space-y-2">
      <button
        v-for="topic in topics"
        :key="topic.id"
        class="w-full text-left p-3 rounded-xl transition-colors group border"
        :class="selectedTopicId === topic.id
          ? 'bg-purple-100 border-purple-400'
          : 'bg-stone-100 border-stone-300 hover:bg-stone-200'"
        @click="handleSelectTopic(topic)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <p
              class="text-sm font-medium"
              :class="selectedTopicId === topic.id ? 'text-purple-700' : 'text-stone-700'"
            >
              {{ topic.title }}
            </p>
            <p v-if="topic.description" class="text-xs text-stone-500 mt-0.5 line-clamp-2">
              {{ topic.description }}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span v-if="topic.estimatedDuration" class="text-xs text-stone-400">
              {{ topic.estimatedDuration }}
            </span>
            <svg
              class="w-4 h-4 transition-colors"
              :class="selectedTopicId === topic.id ? 'text-purple-600' : 'text-stone-500 group-hover:text-stone-700'"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    </div>

    <!-- Hint -->
    <p class="text-xs text-stone-400 mt-3 text-center">
      點擊主題即可自動生成腳本
    </p>
  </div>
</template>
