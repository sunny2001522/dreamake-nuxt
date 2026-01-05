<script setup lang="ts">
import { Gem, ArrowUpRight } from 'lucide-vue-next'
import type { SubscriptionPlan, UserSubscription } from '~/types/subscription'

interface Props {
  plan: SubscriptionPlan
  subscription: UserSubscription
  balance: number
  used: number
  total: number
  periodEnd: string
  daysRemaining: number
}

const props = defineProps<Props>()

const isPaidPlan = computed(() => props.plan.code !== 'free')

const percentage = computed(() => {
  if (!props.total) return 0
  return Math.round((props.used / props.total) * 100)
})

// 格式化日期為 年/月/日
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}/${month}/${day}`
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-stone-200 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-purple-100 rounded-xl">
          <Gem class="w-5 h-5 text-purple-600" />
        </div>
        <h3 class="text-lg font-semibold text-stone-800">Token 使用量</h3>
      </div>
      <span
        :class="[
          'px-3 py-1 text-sm font-medium rounded-full',
          isPaidPlan
            ? 'bg-purple-100 text-purple-700'
            : 'bg-stone-100 text-stone-600',
        ]"
      >
        {{ plan.name }}
      </span>
    </div>

    <!-- 餘額顯示 -->
    <div class="mb-6">
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-bold text-stone-800">{{ balance.toLocaleString() }}</span>
        <span class="text-stone-500">/ {{ total.toLocaleString() }} Token</span>
      </div>
      <p class="text-sm text-stone-500 mt-1">
        目前方案：{{ formatDate(subscription.currentPeriodStart) }} - {{ formatDate(subscription.currentPeriodEnd) }}
      </p>
    </div>

    <!-- 進度條 -->
    <div class="mb-6">
      <div class="flex justify-end text-sm mb-2">
        <span class="text-stone-500">{{ percentage }}%</span>
      </div>
      <div class="h-3 bg-stone-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-pink-500"
          :style="{ width: `${percentage}%` }"
        />
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="flex gap-3 mt-6">
      <NuxtLink
        v-if="!isPaidPlan"
        to="/pricing"
        class="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all"
      >
        升級方案
        <ArrowUpRight class="w-4 h-4" />
      </NuxtLink>
      <NuxtLink
        to="/pricing"
        :class="[
          'flex-1 flex items-center justify-center gap-2 py-3 font-medium rounded-xl transition-colors',
          isPaidPlan
            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            : 'border border-stone-200 text-stone-600 hover:bg-stone-50',
        ]"
      >
        查看方案
      </NuxtLink>
    </div>
  </div>
</template>
