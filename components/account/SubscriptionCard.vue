<script setup lang="ts">
import { Crown, Gem, Calendar, ArrowUpRight } from 'lucide-vue-next'
import type { SubscriptionPlan, UserSubscription } from '~/types/subscription'

interface Props {
  plan: SubscriptionPlan
  subscription: UserSubscription
}

const props = defineProps<Props>()

const isPaidPlan = computed(() => props.plan.code !== 'free')

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
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div
          :class="[
            'p-2 rounded-xl',
            isPaidPlan ? 'bg-purple-100' : 'bg-stone-100',
          ]"
        >
          <Crown
            v-if="isPaidPlan"
            class="w-5 h-5 text-purple-600"
          />
          <Gem
            v-else
            class="w-5 h-5 text-stone-600"
          />
        </div>
        <h3 class="text-lg font-semibold text-stone-800">目前方案</h3>
      </div>
      <span
        :class="[
          'px-3 py-1 text-sm font-medium rounded-full',
          subscription.status === 'active'
            ? 'bg-green-100 text-green-700'
            : 'bg-stone-100 text-stone-600',
        ]"
      >
        {{ subscription.status === 'active' ? '使用中' : subscription.status }}
      </span>
    </div>

    <!-- 方案資訊 -->
    <div class="mb-6">
      <h4 class="text-2xl font-bold text-stone-800 mb-2">{{ plan.name }}</h4>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold text-stone-800">
          NT$ {{ plan.price.toLocaleString() }}
        </span>
        <span class="text-stone-500">/月</span>
      </div>
    </div>

    <!-- Token 配額 -->
    <div
      :class="[
        'p-4 rounded-xl mb-6',
        isPaidPlan ? 'bg-purple-50' : 'bg-stone-50',
      ]"
    >
      <div class="flex items-center gap-2">
        <Gem
          :class="[
            'w-5 h-5',
            isPaidPlan ? 'text-purple-500' : 'text-amber-500',
          ]"
        />
        <span class="font-semibold text-stone-700">
          每月 {{ plan.tokensMonthly.toLocaleString() }} Token
        </span>
      </div>
    </div>

    <!-- 週期資訊 -->
    <div class="space-y-3 mb-6 pt-4 border-t border-stone-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-stone-600">
          <Calendar class="w-4 h-4" />
          <span class="text-sm">週期開始</span>
        </div>
        <span class="text-sm font-medium text-stone-800">
          {{ formatDate(subscription.currentPeriodStart) }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-stone-600">
          <Calendar class="w-4 h-4" />
          <span class="text-sm">週期結束</span>
        </div>
        <span class="text-sm font-medium text-stone-800">
          {{ formatDate(subscription.currentPeriodEnd) }}
        </span>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="flex gap-3">
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
