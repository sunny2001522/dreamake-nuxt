<script setup lang="ts">
import type { SubtitleFont, SubtitleBackground } from '~/types'

const generationStore = useGenerationStore()
const { draft } = storeToRefs(generationStore)

const fonts: { value: SubtitleFont; label: string }[] = [
  { value: 'gothic', label: '黑體' },
  { value: 'ming', label: '明體' },
]

const backgrounds: { value: SubtitleBackground; label: string; preview: string }[] = [
  { value: 'none', label: '無背景', preview: 'bg-transparent' },
  { value: 'black', label: '黑色', preview: 'bg-black' },
  { value: 'white', label: '白色', preview: 'bg-white border border-stone-200' },
]

function setSubtitleEnabled(enabled: boolean) {
  generationStore.updateDraft({ subtitleEnabled: enabled })
}

function setFont(font: SubtitleFont) {
  generationStore.updateDraft({ subtitleFont: font })
}

function setBackground(background: SubtitleBackground) {
  generationStore.updateDraft({ subtitleBackground: background })
}
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-4">
      <label class="text-sm font-medium text-stone-700">字幕設定</label>
      <button
        :class="[
          'relative w-12 h-6 rounded-full transition-colors',
          draft.subtitleEnabled ? 'bg-purple-500' : 'bg-stone-300',
        ]"
        @click="setSubtitleEnabled(!draft.subtitleEnabled)"
      >
        <span
          :class="[
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            draft.subtitleEnabled ? 'translate-x-7' : 'translate-x-1',
          ]"
        />
      </button>
    </div>

    <template v-if="draft.subtitleEnabled">
      <!-- Font Selection -->
      <div class="mb-4">
        <label class="block text-xs text-stone-500 mb-2">字型</label>
        <div class="flex gap-2">
          <button
            v-for="font in fonts"
            :key="font.value"
            :class="[
              'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
              draft.subtitleFont === font.value
                ? 'border-purple-500 bg-purple-50 text-purple-600'
                : 'border-stone-200 hover:border-stone-300 text-stone-600',
            ]"
            @click="setFont(font.value)"
          >
            {{ font.label }}
          </button>
        </div>
      </div>

      <!-- Background Selection -->
      <div>
        <label class="block text-xs text-stone-500 mb-2">背景</label>
        <div class="flex gap-2">
          <button
            v-for="bg in backgrounds"
            :key="bg.value"
            :class="[
              'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
              draft.subtitleBackground === bg.value
                ? 'border-purple-500 bg-purple-50 text-purple-600'
                : 'border-stone-200 hover:border-stone-300 text-stone-600',
            ]"
            @click="setBackground(bg.value)"
          >
            {{ bg.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
