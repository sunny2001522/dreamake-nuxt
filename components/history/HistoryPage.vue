<script setup lang="ts">
// Placeholder for HistoryPage component
// TODO: Implement full history page with video list
const videos = ref<any[]>([])
const isLoading = ref(false)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-stone-800">歷史記錄</h1>
    </div>

    <div v-if="isLoading" class="text-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p class="text-stone-500">載入中...</p>
    </div>

    <div v-else-if="videos.length === 0" class="text-center py-12">
      <svg class="w-16 h-16 mx-auto mb-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <h3 class="text-lg font-medium text-stone-600 mb-2">還沒有影片</h3>
      <p class="text-stone-500 mb-6">開始創作您的第一個 AI 影片吧！</p>
      <CommonButton @click="navigateTo('/create')">
        開始創作
      </CommonButton>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <HistoryHistoryItem
        v-for="video in videos"
        :key="video.id"
        :video="video"
      />
    </div>
  </div>
</template>
