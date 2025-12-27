<script setup lang="ts">
import type { VideoModel } from '~/types'

const generationStore = useGenerationStore()
const { draft } = storeToRefs(generationStore)

const models: { value: VideoModel; label: string }[] = [
  { value: 'vidnoz', label: '一般品質' },
  { value: 'wavespeed', label: '高品質' },
]

const DEFAULT_WAVESPEED_PROMPT = '對著鏡頭講話，侃侃而談，搭配手部動作，輕鬆而自然'

function setVideoModel(model: VideoModel) {
  generationStore.updateDraft({ videoModel: model })
}

function setWaveSpeedPrompt(prompt: string) {
  generationStore.updateDraft({ waveSpeedPrompt: prompt })
}
</script>

<template>
  <div class="card p-4">
    <!-- 影片品質選擇 -->
    <div :class="{ 'mb-4': draft.videoModel === 'wavespeed' }">
      <label class="text-sm font-medium text-stone-700 mb-2 block">影片品質</label>
      <select
        :value="draft.videoModel"
        class="w-full bg-white border border-stone-300 text-stone-900 rounded-lg focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500 py-2.5 px-3 cursor-pointer"
        @change="setVideoModel(($event.target as HTMLSelectElement).value as VideoModel)"
      >
        <option v-for="model in models" :key="model.value" :value="model.value">
          {{ model.label }}
        </option>
      </select>
    </div>

    <!-- 動作描述 (只在高品質時顯示) -->
    <div v-if="draft.videoModel === 'wavespeed'">
      <label class="text-sm font-medium text-stone-700 mb-2 block">動作描述</label>
      <textarea
        :value="draft.waveSpeedPrompt"
        :placeholder="DEFAULT_WAVESPEED_PROMPT"
        rows="2"
        class="w-full bg-white border border-stone-300 text-stone-900 rounded-lg focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500 py-2.5 px-3 placeholder-stone-400 resize-none"
        @input="setWaveSpeedPrompt(($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>
