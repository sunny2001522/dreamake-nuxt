<script setup lang="ts">
const generationStore = useGenerationStore()
const { draft, generatedResult } = storeToRefs(generationStore)

const aspectRatioClass = computed(() => {
  return draft.value.aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
})
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">預覽</label>
    </div>

    <div
      :class="[
        'relative bg-stone-900 rounded-xl overflow-hidden flex items-center justify-center',
        aspectRatioClass,
      ]"
    >
      <!-- Video/Audio Player Placeholder -->
      <template v-if="generatedResult?.videoUrl">
        <video
          :src="generatedResult.videoUrl"
          controls
          class="w-full h-full object-contain"
        />
      </template>
      <template v-else-if="draft.avatarPreview">
        <img
          :src="draft.avatarPreview"
          alt="Avatar preview"
          class="w-full h-full object-cover"
        />
      </template>
      <template v-else>
        <div class="text-center text-stone-500">
          <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">選擇頭像開始預覽</p>
        </div>
      </template>
    </div>
  </div>
</template>
