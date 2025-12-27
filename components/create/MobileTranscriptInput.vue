<script setup lang="ts">
import { Mic, Sparkles } from 'lucide-vue-next'
import SoundWaveIndicator from '~/components/common/SoundWaveIndicator.vue'

const generationStore = useGenerationStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

const transcriptGeneration = useTranscriptGeneration()
const isGenerating = computed(() => transcriptGeneration.isGenerating.value)
const isGeneratingTitle = ref(false)

// AI generation modal
const showAIModal = ref(false)
const aiTopic = ref('')

// Textarea auto-resize
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Interim text for real-time display
const titleInterimText = ref('')
const transcriptInterimText = ref('')

// Display text combining confirmed and interim results
const displayTitle = computed(() => draft.value.title + titleInterimText.value)
const displayTranscript = computed(() => draft.value.transcript + transcriptInterimText.value)

// Speech recognition for title
const titleSpeech = useSpeechRecognition({
  onTranscript: (text, isFinal) => {
    if (isFinal) {
      generationStore.updateDraft({ title: draft.value.title + text })
      titleInterimText.value = ''
    } else {
      titleInterimText.value = text
    }
  },
  onError: (error) => toastStore.error(error),
  lang: 'zh-TW',
})

// Speech recognition for transcript
const transcriptSpeech = useSpeechRecognition({
  onTranscript: (text, isFinal) => {
    if (isFinal) {
      generationStore.updateDraft({ transcript: draft.value.transcript + text })
      transcriptInterimText.value = ''
    } else {
      transcriptInterimText.value = text
    }
  },
  onError: (error) => toastStore.error(error),
  lang: 'zh-TW',
})

function adjustTextareaHeight() {
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  const maxHeight = 88 // 約四行高度 (22px * 4)
  textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
}

function handleInput(value: string) {
  generationStore.updateDraft({ transcript: value })
  nextTick(adjustTextareaHeight)
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

function handleTitleInput(value: string) {
  generationStore.updateDraft({ title: value })
}

function handleTitleMicClick() {
  if (titleSpeech.isListening.value) {
    titleSpeech.stopListening()
  } else {
    titleSpeech.startListening()
  }
}

function handleTranscriptMicClick() {
  if (transcriptSpeech.isListening.value) {
    transcriptSpeech.stopListening()
  } else {
    transcriptSpeech.startListening()
  }
}

async function handleGenerateTitle() {
  if (!draft.value.transcript.trim()) {
    toastStore.warning('請先輸入腳本內容')
    return
  }

  try {
    isGeneratingTitle.value = true
    const title = await transcriptGeneration.generateTitle(draft.value.transcript)
    generationStore.updateDraft({ title })
    toastStore.success('標題生成完成！')
  } catch (err: any) {
    console.error('Failed to generate title:', err)
    toastStore.error('標題生成失敗', err.message || '請稍後再試')
  } finally {
    isGeneratingTitle.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Section label -->
   

    <!-- Title input with mic and AI buttons -->
    <div class="relative">
      <input
        :value="displayTitle"
        type="text"
        placeholder="輸入標題..."
        class="w-full px-3 py-2 pr-16 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/20"
        @input="handleTitleInput(($event.target as HTMLInputElement).value)"
      />
      <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <button
          class="p-1.5 transition-colors"
          :class="titleSpeech.isListening.value ? 'text-red-500' : 'text-stone-400 hover:text-stone-600'"
          :title="titleSpeech.isListening.value ? '停止錄音' : '語音輸入'"
          @click="handleTitleMicClick"
        >
          <SoundWaveIndicator v-if="titleSpeech.isListening.value" :active="true" size="sm" color="red" />
          <Mic v-else class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 text-stone-400 hover:text-stone-700 transition-colors"
          title="AI 生成標題"
          :disabled="isGeneratingTitle"
          @click="handleGenerateTitle"
        >
          <svg v-if="isGeneratingTitle" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <Sparkles v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Transcript textarea with mic and AI buttons -->
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="displayTranscript"
        rows="1"
        placeholder="輸入逐字稿..."
        class="w-full px-3 py-2 pr-16 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/20 resize-none overflow-hidden"
        @input="handleInput(($event.target as HTMLTextAreaElement).value)"
      />
      <div class="absolute right-1.5 top-2 flex items-center gap-0.5">
        <button
          class="p-1.5 transition-colors"
          :class="transcriptSpeech.isListening.value ? 'text-red-500' : 'text-stone-400 hover:text-stone-600'"
          :title="transcriptSpeech.isListening.value ? '停止錄音' : '語音輸入'"
          @click="handleTranscriptMicClick"
        >
          <SoundWaveIndicator v-if="transcriptSpeech.isListening.value" :active="true" size="sm" color="red" />
          <Mic v-else class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 text-stone-400 hover:text-stone-700 transition-colors"
          title="AI 生成"
          @click="showAIModal = true"
        >
          <Sparkles class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- AI Generation Modal -->
    <Teleport to="body">
      <div
        v-if="showAIModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        @click="showAIModal = false"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden w-full max-w-md"
          @click.stop
        >
          <div class="px-4 py-3 border-b flex items-center justify-between">
            <h3 class="font-bold text-stone-800">AI 生成腳本</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg"
              @click="showAIModal = false"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2">主題</label>
              <input
                v-model="aiTopic"
                type="text"
                placeholder="例如：如何提升工作效率"
                class="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/20"
                @keyup.enter="handleGenerateScript"
              />
            </div>

            <p class="text-sm text-stone-500">
              AI 會根據主題生成適合短影片的腳本內容。
            </p>
          </div>

          <div class="px-4 py-3 border-t flex justify-end gap-2">
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
              @click="showAIModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 flex items-center gap-2"
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
