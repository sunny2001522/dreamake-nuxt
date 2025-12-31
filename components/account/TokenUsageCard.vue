<script setup lang="ts">
import { Gem, TrendingUp, Calendar } from 'lucide-vue-next'

interface Props {
  balance: number
  used: number
  total: number
  periodEnd: string
  daysRemaining: number
}

const props = defineProps<Props>()

const percentage = computed(() => {
  if (!props.total) return 0
  return Math.round((props.used / props.total) * 100)
})

const remaining = computed(() => props.total - props.used)

const statusColor = computed(() => {
  const remainingPercent = (remaining.value / props.total) * 100
  if (remainingPercent <= 10) return 'critical'
  if (remainingPercent <= 30) return 'warning'
  return 'normal'
})

const progressBarClass = computed(() => {
  switch (statusColor.value) {
    case 'critical':
      return 'bg-red-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-purple-500'
  }
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-stone-200 p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 bg-purple-100 rounded-xl">
        <Gem class="w-5 h-5 text-purple-600" />
      </div>
      <h3 class="text-lg font-semibold text-stone-800">Token 使用量</h3>
    </div>

    <!-- 餘額顯示 -->
    <div class="mb-6">
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-bold text-stone-800">{{ balance }}</span>
        <span class="text-stone-500">/ {{ total }} Token</span>
      </div>
      <p class="text-sm text-stone-500 mt-1">可用餘額</p>
    </div>

    <!-- 進度條 -->
    <div class="mb-6">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-stone-600">已使用 {{ used }} Token</span>
        <span class="text-stone-500">{{ percentage }}%</span>
      </div>
      <div class="h-3 bg-stone-100 rounded-full overflow-hidden">
        <div
          :class="['h-full rounded-full transition-all duration-500', progressBarClass]"
          :style="{ width: `${percentage}%` }"
        />
      </div>
    </div>

    <!-- 統計資訊 -->
    <div class="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
      <div class="flex items-center gap-3">
        <TrendingUp class="w-4 h-4 text-stone-400" />
        <div>
          <p class="text-sm text-stone-500">剩餘</p>
          <p class="font-medium text-stone-800">{{ remaining }} Token</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <Calendar class="w-4 h-4 text-stone-400" />
        <div>
          <p class="text-sm text-stone-500">重置日期</p>
          <p class="font-medium text-stone-800">{{ daysRemaining }} 天後</p>
        </div>
      </div>
    </div>

    <!-- 低餘額警告 -->
    <div
      v-if="statusColor === 'critical'"
      class="mt-4 p-3 bg-red-50 rounded-xl"
    >
      <p class="text-sm text-red-700">
        Token 餘額即將用盡，請考慮升級方案以獲取更多 Token
      </p>
    </div>
    <div
      v-else-if="statusColor === 'warning'"
      class="mt-4 p-3 bg-amber-50 rounded-xl"
    >
      <p class="text-sm text-amber-700">
        Token 餘額較低，建議適量使用或升級方案
      </p>
    </div>
  </div>
</template>
