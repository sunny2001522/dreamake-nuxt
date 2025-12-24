<script setup lang="ts">
const generationStore = useGenerationStore()
const { stage, stepDurations, isGenerating } = storeToRefs(generationStore)

const stages = [
  { key: 'voice', label: '生成語音' },
  { key: 'subtitle', label: '處理字幕' },
  { key: 'video', label: '生成影片' },
]

const currentStageIndex = computed(() => {
  const stageKeys = ['voice', 'subtitle', 'video']
  const index = stageKeys.indexOf(stage.value)
  return index >= 0 ? index : -1
})
</script>

<template>
  <div v-if="isGenerating" class="card p-4">
    <div class="flex items-center gap-2 mb-4">
      <div class="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
      <span class="text-sm font-medium text-stone-700">生成中...</span>
    </div>

    <div class="space-y-3">
      <div
        v-for="(s, index) in stages"
        :key="s.key"
        class="flex items-center gap-3"
      >
        <div
          :class="[
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            index < currentStageIndex
              ? 'bg-green-500 text-white'
              : index === currentStageIndex
                ? 'bg-purple-500 text-white animate-pulse'
                : 'bg-stone-200 text-stone-500',
          ]"
        >
          <template v-if="index < currentStageIndex">✓</template>
          <template v-else>{{ index + 1 }}</template>
        </div>
        <span
          :class="[
            'text-sm',
            index <= currentStageIndex ? 'text-stone-800' : 'text-stone-400',
          ]"
        >
          {{ s.label }}
        </span>
        <span
          v-if="stepDurations[s.key]"
          class="text-xs text-stone-400 ml-auto"
        >
          {{ stepDurations[s.key].toFixed(1) }}s
        </span>
      </div>
    </div>
  </div>
</template>
