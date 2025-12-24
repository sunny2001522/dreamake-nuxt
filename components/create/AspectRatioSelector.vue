<script setup lang="ts">
import { Smartphone, Monitor } from 'lucide-vue-next'
import type { AspectRatio } from '~/types'

const props = defineProps<{
  modelValue: AspectRatio
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AspectRatio]
}>()

const options: { value: AspectRatio; label: string; icon: any }[] = [
  { value: 'portrait', label: '9:16', icon: Smartphone },
  { value: 'landscape', label: '16:9', icon: Monitor },
]
</script>

<template>
  <div class="space-y-2">
    <label class="text-sm font-medium text-stone-700">3. 影片比例</label>
    <div class="flex gap-2">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
        :class="modelValue === option.value
          ? 'border-purple-500 bg-purple-50 text-purple-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'"
        @click="emit('update:modelValue', option.value)"
      >
        <component :is="option.icon" class="w-4 h-4" />
        <span class="text-sm font-medium">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>
