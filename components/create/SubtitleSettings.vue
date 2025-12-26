<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import type { SubtitleFont, SubtitleBackground } from '~/types'

const generationStore = useGenerationStore()
const { draft } = storeToRefs(generationStore)

const fonts: { value: SubtitleFont; label: string }[] = [
  { value: 'gothic', label: '黑體' },
  { value: 'ming', label: '明體' },
]

const backgrounds: { value: SubtitleBackground; label: string }[] = [
  { value: 'none', label: '無背景' },
  { value: 'black', label: '黑色背景' },
  { value: 'white', label: '白色背景' },
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
    <div class="flex items-center justify-between mb-3">
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

    <div v-if="draft.subtitleEnabled" class="flex gap-2">
      <!-- Font Dropdown -->
      <div class="relative flex-1">
        <select
          :value="draft.subtitleFont"
          class="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 pl-3 pr-8 cursor-pointer hover:border-stone-300 focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
          @change="setFont(($event.target as HTMLSelectElement).value as SubtitleFont)"
        >
          <option v-for="font in fonts" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
        <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
      </div>

      <!-- Background Dropdown -->
      <div class="relative flex-1">
        <select
          :value="draft.subtitleBackground"
          class="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 pl-3 pr-8 cursor-pointer hover:border-stone-300 focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
          @change="setBackground(($event.target as HTMLSelectElement).value as SubtitleBackground)"
        >
          <option v-for="bg in backgrounds" :key="bg.value" :value="bg.value">
            {{ bg.label }}
          </option>
        </select>
        <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
      </div>
    </div>
  </div>
</template>
