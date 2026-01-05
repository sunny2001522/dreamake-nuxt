<script setup lang="ts">
const pendingStore = usePendingAnalysesStore()

// 格式化最後輪詢時間
const lastPollTimeText = computed(() => {
  if (!pendingStore.lastPollTime) return null
  const now = new Date()
  const diff = Math.floor((now.getTime() - pendingStore.lastPollTime.getTime()) / 1000)

  if (diff < 60) return '剛剛'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  return `${Math.floor(diff / 3600)} 小時前`
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="pendingStore.pendingCount > 0"
        class="fixed bottom-4 right-4 z-40"
      >
        <div class="bg-purple-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <!-- 動畫指示器 -->
          <div class="relative">
            <div class="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <div class="absolute inset-0 w-2.5 h-2.5 bg-white rounded-full animate-ping opacity-75" />
          </div>

          <!-- 文字內容 -->
          <div class="flex flex-col">
            <span class="text-sm font-medium">
              {{ pendingStore.pendingCount }} 個分析進行中
            </span>
            <span v-if="lastPollTimeText" class="text-xs text-purple-200">
              上次檢查：{{ lastPollTimeText }}
            </span>
          </div>

          <!-- 載入中圖示 -->
          <svg
            v-if="pendingStore.isPolling"
            class="w-4 h-4 animate-spin text-purple-200"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
