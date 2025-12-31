<script setup lang="ts">
import { User, Mail, Shield, Clock, ArrowLeft } from 'lucide-vue-next'
import type { TokenTransaction } from '~/types/subscription'

definePageMeta({
  layout: 'default',
})

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const {
  plan,
  subscription,
  tokenBalance,
  tokensUsedThisPeriod,
  monthlyQuota,
  periodEnd,
  daysRemaining,
  isLoading,
} = storeToRefs(subscriptionStore)

// 獲取交易記錄
const transactions = ref<TokenTransaction[]>([])
const isLoadingTransactions = ref(false)

async function loadTransactions() {
  if (!authStore.authInfo.sub) return

  isLoadingTransactions.value = true
  try {
    const response = await $fetch<{ transactions: TokenTransaction[] }>('/api/tokens/transactions', {
      query: {
        userId: authStore.authInfo.sub,
        limit: 10,
      },
    })
    transactions.value = response.transactions
  } catch (error) {
    console.error('Failed to load transactions:', error)
  } finally {
    isLoadingTransactions.value = false
  }
}

onMounted(() => {
  loadTransactions()
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    grant: '發放',
    consume: '使用',
    refund: '退還',
    adjust: '調整',
    bonus: '加贈',
  }
  return labels[type] || type
}

function getTransactionTypeClass(type: string): string {
  if (type === 'consume') return 'text-red-600'
  return 'text-green-600'
}
</script>

<template>
  <div class="min-h-screen bg-stone-50">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <NuxtLink
          to="/create"
          class="inline-flex items-center gap-2 text-stone-600 hover:text-stone-800 mb-4"
        >
          <ArrowLeft class="w-4 h-4" />
          返回創作
        </NuxtLink>
        <h1 class="text-2xl font-bold text-stone-800">帳戶設定</h1>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 左側：用戶資料和訂閱 -->
        <div class="lg:col-span-2 space-y-6">
          <!-- 用戶資料卡 -->
          <div class="bg-white rounded-2xl border border-stone-200 p-6">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-stone-100 rounded-xl">
                <User class="w-5 h-5 text-stone-600" />
              </div>
              <h3 class="text-lg font-semibold text-stone-800">個人資料</h3>
            </div>

            <div class="flex items-center gap-4 mb-6">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <span class="text-2xl font-bold text-white">
                  {{ authStore.authInfo.nickname?.charAt(0) || 'U' }}
                </span>
              </div>
              <div>
                <h4 class="text-xl font-semibold text-stone-800">
                  {{ authStore.authInfo.nickname || '使用者' }}
                </h4>
                <p class="text-stone-500">CMoney 帳號</p>
              </div>
            </div>

            <div class="space-y-4 pt-4 border-t border-stone-100">
              <div class="flex items-center gap-3">
                <Mail class="w-4 h-4 text-stone-400" />
                <span class="text-stone-600">{{ authStore.authInfo.email || '未設定' }}</span>
              </div>
              <div class="flex items-center gap-3">
                <Shield class="w-4 h-4 text-stone-400" />
                <span class="text-stone-600">帳號已連結 CMoney</span>
              </div>
            </div>
          </div>

          <!-- 訂閱狀態卡 -->
          <AccountSubscriptionCard
            v-if="plan && subscription"
            :plan="plan"
            :subscription="subscription"
          />
          <div
            v-else-if="isLoading"
            class="bg-white rounded-2xl border border-stone-200 p-6 animate-pulse"
          >
            <div class="h-6 bg-stone-200 rounded w-1/3 mb-4" />
            <div class="h-10 bg-stone-200 rounded w-1/2 mb-4" />
            <div class="h-4 bg-stone-200 rounded w-full" />
          </div>
        </div>

        <!-- 右側：Token 使用量 -->
        <div class="space-y-6">
          <!-- Token 使用量卡 -->
          <AccountTokenUsageCard
            :balance="tokenBalance"
            :used="tokensUsedThisPeriod"
            :total="monthlyQuota"
            :period-end="periodEnd"
            :days-remaining="daysRemaining"
          />

          <!-- 交易記錄 -->
          <div class="bg-white rounded-2xl border border-stone-200 p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-stone-100 rounded-xl">
                <Clock class="w-5 h-5 text-stone-600" />
              </div>
              <h3 class="text-lg font-semibold text-stone-800">近期記錄</h3>
            </div>

            <div v-if="isLoadingTransactions" class="space-y-3">
              <div v-for="i in 3" :key="i" class="h-12 bg-stone-100 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="transactions.length === 0" class="text-center py-8 text-stone-500">
              暫無交易記錄
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="tx in transactions"
                :key="tx.id"
                class="flex items-center justify-between py-2 border-b border-stone-50 last:border-0"
              >
                <div>
                  <p class="text-sm font-medium text-stone-800">
                    {{ tx.description || getTransactionTypeLabel(tx.type) }}
                  </p>
                  <p class="text-xs text-stone-500">
                    {{ formatDate(tx.createdAt) }}
                  </p>
                </div>
                <span
                  :class="[
                    'font-semibold',
                    getTransactionTypeClass(tx.type),
                  ]"
                >
                  {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
