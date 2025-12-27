<script setup lang="ts">
import type { GenerationRecord } from '~/types'

interface Props {
  video: GenerationRecord
}

const props = defineProps<Props>()

const formattedDate = computed(() => {
  return new Date(props.video.createdAt).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})
</script>

<template>
  <div class="card overflow-hidden hover:shadow-md transition-shadow">
    <div class="aspect-video bg-stone-100 relative">
      <img
        v-if="video.thumbnailUrl"
        :src="video.thumbnailUrl"
        alt="Video thumbnail"
        class="w-full h-full object-cover"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-stone-400"
      >
        <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- Status Badge -->
      <div
        :class="[
          'absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full',
          video.status === 'completed'
            ? 'bg-green-500 text-white'
            : video.status === 'processing'
              ? 'bg-yellow-500 text-white'
              : 'bg-red-500 text-white',
        ]"
      >
        {{ video.status === 'completed' ? '完成' : video.status === 'processing' ? '處理中' : '失敗' }}
      </div>
    </div>

    <div class="p-4">
      <h3 class="font-medium text-stone-800 mb-1 truncate">
        {{ video.title || '未命名影片' }}
      </h3>
      <p class="text-xs text-stone-500">
        {{ formattedDate }}
      </p>
    </div>
  </div>
</template>
