<script setup lang="ts">
import { CheckCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-vue-next'
import { FanshipStatus, type PaymentResult } from '~/types/fanbar'

definePageMeta({
  layout: 'auth',
})

const { handlePaymentCallback, getReturnPath, getCheckoutUrl } = useFanbarPayment()

const isProcessing = ref(true)
const result = ref<PaymentResult | null>(null)
const returnPath = ref('/pricing')

onMounted(async () => {
  // 先取得返回路徑
  returnPath.value = getReturnPath()

  // 處理付款回調
  result.value = await handlePaymentCallback()
  isProcessing.value = false

  // 成功時自動跳轉
  if (result.value.success) {
    setTimeout(() => {
      navigateTo(returnPath.value)
    }, 2000)
  }
})

function handleRetry() {
  window.location.href = getCheckoutUrl()
}

function handleGoBack() {
  navigateTo(returnPath.value)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <!-- 處理中 -->
    <div v-if="isProcessing" class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
      <p class="text-stone-600">正在驗證付款狀態...</p>
    </div>

    <!-- 成功 -->
    <div v-else-if="result?.success" class="text-center bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle class="w-10 h-10 text-green-500" />
      </div>
      <h1 class="text-2xl font-bold text-stone-800 mb-2">訂閱成功！</h1>
      <p class="text-stone-600 mb-4">
        已增加 <span class="font-semibold text-purple-600">{{ result.tokensAdded }}</span> Token
      </p>
      <p class="text-sm text-stone-500">即將返回...</p>
    </div>

    <!-- 失敗 -->
    <div v-else class="text-center bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle class="w-10 h-10 text-red-500" />
      </div>
      <h1 class="text-2xl font-bold text-stone-800 mb-2">
        {{ result?.status === FanshipStatus.Cancelled ? '訂閱已取消' : '付款失敗' }}
      </h1>
      <p class="text-stone-600 mb-6">{{ result?.message }}</p>

      <div class="flex gap-3">
        <button
          class="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all"
          @click="handleRetry"
        >
          <RefreshCw class="w-4 h-4" />
          再次付款
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-2 py-3 border border-stone-200 text-stone-600 font-medium rounded-xl hover:bg-stone-50 transition-colors"
          @click="handleGoBack"
        >
          <ArrowLeft class="w-4 h-4" />
          返回
        </button>
      </div>
    </div>
  </div>
</template>
