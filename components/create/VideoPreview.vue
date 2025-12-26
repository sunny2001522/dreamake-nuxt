<script setup lang="ts">
const generationStore = useGenerationStore()
const { draft, generatedResult } = storeToRefs(generationStore)

const aspectRatioClass = computed(() => {
  return draft.value.aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
})
</script>

<template>
  <div class="relative w-full">
    <!-- Preview container -->
    <div
      :class="[
        'relative bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center mx-auto',
        aspectRatioClass,
        // Mobile: constrain portrait height
        draft.aspectRatio === 'portrait' ? 'max-h-[60vh] w-auto' : 'w-full',
        // Desktop: fill available space
        'lg:h-full lg:max-h-none',
        draft.aspectRatio === 'portrait' ? 'lg:max-w-[calc((100vh-120px)*9/16)]' : 'lg:w-full',
      ]"
    >
      <!-- Video Player -->
      <template v-if="generatedResult?.videoUrl">
        <video
          :src="generatedResult.videoUrl"
          controls
          class="w-full h-full object-contain"
        />
      </template>
      <!-- Avatar Preview -->
      <template v-else-if="draft.avatarPreview">
        <img
          :src="draft.avatarPreview"
          alt="Avatar preview"
          class="w-full h-full object-cover"
        />
        <!-- Subtitle preview overlay -->
        <div class="absolute bottom-4 left-0 right-0 text-center">
          <span class="px-3 py-1 text-white text-sm bg-black/50 rounded">字幕預覽效果</span>
        </div>
      </template>
      <!-- Empty state -->
      <template v-else>
        <div class="text-center text-stone-500">
          <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">選擇頭像開始預覽</p>
        </div>
      </template>
    </div>

    <!-- Ratio indicator (mobile only) -->
    <p class="lg:hidden text-center text-xs text-stone-400 mt-2">
      預覽模式 ({{ draft.aspectRatio === 'portrait' ? '9:16' : '16:9' }})
    </p>
  </div>
</template>
