<script setup lang="ts">
import { ImageIcon, Music, Smartphone, Monitor, Settings, Volume2, Video } from 'lucide-vue-next'
import type { AspectRatio } from '~/types'

const generationStore = useGenerationStore()
const { draft, isGenerating } = storeToRefs(generationStore)

// Emit events for parent to handle
const emit = defineEmits<{
  openImagePicker: []
  openVoicePicker: []
  openSettings: []
  generateVoice: []
  generateVideo: []
}>()

// Toggle aspect ratio
function toggleAspectRatio() {
  const newRatio: AspectRatio = draft.value.aspectRatio === 'portrait' ? 'landscape' : 'portrait'
  generationStore.updateDraft({ aspectRatio: newRatio })
}

// Check if can generate
const canGenerate = computed(() => {
  return (
    draft.value.transcript.trim().length > 0 &&
    draft.value.avatarPreview &&
    draft.value.voicePreview?.speakerId &&
    !isGenerating.value
  )
})
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 safe-area-bottom z-30">
    <div class="flex items-center justify-between">
      <!-- Left: Tool buttons -->
      <div class="flex items-center gap-1">
        <!-- Image picker -->
        <button
          class="p-3 rounded-full transition-colors"
          :class="draft.avatarPreview ? 'bg-purple-100 text-purple-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'"
          @click="emit('openImagePicker')"
        >
          <ImageIcon class="w-5 h-5" />
        </button>

        <!-- Voice picker -->
        <button
          class="p-3 rounded-full transition-colors"
          :class="draft.voicePreview?.speakerId ? 'bg-purple-100 text-purple-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'"
          @click="emit('openVoicePicker')"
        >
          <Music class="w-5 h-5" />
        </button>

        <!-- Aspect ratio toggle -->
        <button
          class="p-3 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
          @click="toggleAspectRatio"
        >
          <Smartphone v-if="draft.aspectRatio === 'portrait'" class="w-5 h-5" />
          <Monitor v-else class="w-5 h-5" />
        </button>

        <!-- Settings -->
        <button
          class="p-3 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
          @click="emit('openSettings')"
        >
          <Settings class="w-5 h-5" />
        </button>
      </div>

      <!-- Right: Generate buttons -->
      <div class="flex items-center gap-2">
        <!-- Generate voice -->
        <button
          class="p-3 rounded-full transition-colors disabled:opacity-40"
          :class="canGenerate ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'bg-stone-100 text-stone-400'"
          :disabled="!canGenerate"
          @click="emit('generateVoice')"
        >
          <Volume2 class="w-5 h-5" />
        </button>

        <!-- Generate video -->
        <button
          class="p-3 rounded-full transition-colors disabled:opacity-40"
          :class="canGenerate ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-stone-100 text-stone-400'"
          :disabled="!canGenerate"
          @click="emit('generateVideo')"
        >
          <Video class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.safe-area-bottom {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
</style>
