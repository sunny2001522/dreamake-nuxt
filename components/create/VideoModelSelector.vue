<script setup lang="ts">
import { Gem } from 'lucide-vue-next'
import type { VideoModel } from '~/types'
import { VIDEO_TOKEN_COSTS } from '~/types/subscription'

const generationStore = useGenerationStore()
const { draft } = storeToRefs(generationStore)

const models: { value: VideoModel; label: string; tokenCost: number }[] = [
  { value: 'vidnoz', label: '一般品質', tokenCost: VIDEO_TOKEN_COSTS.vidnoz.perMinute },
  { value: 'wavespeed', label: '高品質', tokenCost: VIDEO_TOKEN_COSTS.wavespeed.perMinute },
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
    <!-- 影片品質選擇 (已隱藏，直接使用高品質) -->
    <div v-if="false" :class="{ 'mb-4': draft.videoModel === 'wavespeed' }">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-stone-700">影片品質</label>
        <!-- Token 每分鐘費率顯示 -->
        <span class="flex items-center gap-1 text-xs text-purple-600">
          <Gem class="w-3 h-3" />
          <span>{{ models.find(m => m.value === draft.videoModel)?.tokenCost }} /分鐘</span>
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="model in models"
          :key="model.value"
          :class="[
            'relative flex flex-col items-center justify-center py-3 px-4 rounded-lg border-2 transition-all',
            draft.videoModel === model.value
              ? 'border-purple-500 bg-purple-50'
              : 'border-stone-200 hover:border-stone-300 bg-white',
          ]"
          @click="setVideoModel(model.value)"
        >
          <span
            :class="[
              'text-sm font-medium',
              draft.videoModel === model.value ? 'text-purple-700' : 'text-stone-700',
            ]"
          >
            {{ model.label }}
          </span>
          <span
            :class="[
              'flex items-center gap-0.5 text-xs mt-1',
              draft.videoModel === model.value ? 'text-purple-500' : 'text-stone-400',
            ]"
          >
            <Gem class="w-3 h-3" />
            {{ model.tokenCost }}
          </span>
        </button>
      </div>
    </div>

    <!-- 動作描述 (高品質功能，現在總是顯示) -->
    <div>
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
