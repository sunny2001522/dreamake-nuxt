<script setup lang="ts">
const generationStore = useGenerationStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

// Transcript generation composable
const transcriptGeneration = useTranscriptGeneration()

const maxLength = 500
const charCount = computed(() => draft.value.transcript.length)
const isOverLimit = computed(() => charCount.value > maxLength)

// AI generation modal
const showAIModal = ref(false)
const aiTopic = ref('')
const isGenerating = computed(() => transcriptGeneration.isGenerating.value)

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
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">腳本內容</label>
      <span
        :class="[
          'text-xs',
          isOverLimit ? 'text-red-500' : 'text-stone-400',
        ]"
      >
        {{ charCount }} / {{ maxLength }}
      </span>
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
          class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
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

    <textarea
      :value="draft.transcript"
      placeholder="輸入您想要說的內容..."
      class="w-full h-40 p-4 text-stone-800 bg-stone-50 border border-stone-200 rounded-xl resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
      @input="handleInput(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Action buttons -->
    <div class="mt-3 flex items-center gap-2">
      <button
        class="flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        語音輸入
      </button>

      <button
        class="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        @click="openAIModal"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        AI 生成
      </button>
    </div>

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
