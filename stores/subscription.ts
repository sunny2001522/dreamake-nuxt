import { defineStore } from 'pinia'
import type {
  PlanCode,
  SubscriptionPlan,
  UserSubscription,
  TokenBalanceResponse,
  SubscriptionInfoResponse,
  TokenCheckResponse,
  TokenConsumeResponse,
} from '~/types/subscription'

export const useSubscriptionStore = defineStore('subscription', () => {
  // State
  const plan = ref<SubscriptionPlan | null>(null)
  const subscription = ref<UserSubscription | null>(null)
  const tokenBalance = ref(0)
  const tokensUsedThisPeriod = ref(0)
  const tokensGrantedThisPeriod = ref(0)
  const periodEnd = ref('')
  const daysRemaining = ref(0)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // Getters
  const planCode = computed(() => plan.value?.code || 'free')
  const planName = computed(() => plan.value?.name || '免費方案')
  const monthlyQuota = computed(() => plan.value?.tokensMonthly || 100)
  const isPaidPlan = computed(() => planCode.value !== 'free')

  const tokenPercentage = computed(() => {
    if (!monthlyQuota.value) return 0
    return Math.round((tokensUsedThisPeriod.value / monthlyQuota.value) * 100)
  })

  const isLowBalance = computed(() => tokenBalance.value < 20)
  const isCriticalBalance = computed(() => tokenBalance.value < 5)

  // Actions
  function hasEnoughTokens(cost: number): boolean {
    return tokenBalance.value >= cost
  }

  async function loadSubscription(userId: string) {
    if (!userId) return

    isLoading.value = true

    try {
      const response = await $fetch<SubscriptionInfoResponse>('/api/subscription/current', {
        query: { userId },
      })

      plan.value = response.plan
      subscription.value = response.subscription
      tokenBalance.value = response.tokens.balance
      tokensUsedThisPeriod.value = response.tokens.tokensUsedThisPeriod
      tokensGrantedThisPeriod.value = response.tokens.tokensGrantedThisPeriod
      periodEnd.value = response.tokens.periodEnd
      daysRemaining.value = response.tokens.daysRemaining
      isInitialized.value = true
    } catch (error) {
      console.error('[SubscriptionStore] Failed to load subscription:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function refreshBalance(userId: string) {
    if (!userId) return

    try {
      const response = await $fetch<TokenBalanceResponse>('/api/tokens/balance', {
        query: { userId },
      })

      tokenBalance.value = response.balance
      tokensUsedThisPeriod.value = response.tokensUsedThisPeriod
      tokensGrantedThisPeriod.value = response.tokensGrantedThisPeriod
      periodEnd.value = response.periodEnd
      daysRemaining.value = response.daysRemaining

      if (response.plan) {
        plan.value = response.plan
      }
    } catch (error) {
      console.error('[SubscriptionStore] Failed to refresh balance:', error)
    }
  }

  async function checkTokens(
    userId: string,
    operationType: string,
    durationMinutes?: number
  ): Promise<TokenCheckResponse> {
    try {
      const response = await $fetch<TokenCheckResponse>('/api/tokens/check', {
        method: 'POST',
        body: {
          userId,
          operationType,
          durationMinutes,
        },
      })

      return response
    } catch (error) {
      console.error('[SubscriptionStore] Failed to check tokens:', error)
      return {
        sufficient: false,
        cost: 0,
        currentBalance: tokenBalance.value,
      }
    }
  }

  async function consumeTokens(
    userId: string,
    operationType: string,
    options?: {
      operationId?: string
      durationMinutes?: number
      description?: string
    }
  ): Promise<{ success: boolean; consumed: number; error?: string }> {
    try {
      const response = await $fetch<TokenConsumeResponse>('/api/tokens/consume', {
        method: 'POST',
        body: {
          userId,
          operationType,
          operationId: options?.operationId,
          durationMinutes: options?.durationMinutes,
          description: options?.description,
        },
      })

      // 更新本地狀態
      tokenBalance.value = response.balanceAfter
      tokensUsedThisPeriod.value += response.consumed

      return {
        success: true,
        consumed: response.consumed,
      }
    } catch (error: any) {
      console.error('[SubscriptionStore] Failed to consume tokens:', error)

      // 處理餘額不足的錯誤
      if (error.statusCode === 402) {
        return {
          success: false,
          consumed: 0,
          error: 'INSUFFICIENT_BALANCE',
        }
      }

      return {
        success: false,
        consumed: 0,
        error: error.message || 'Unknown error',
      }
    }
  }

  async function checkAndConsume(
    userId: string,
    operationType: string,
    durationMinutes?: number
  ): Promise<{
    success: boolean
    cost: number
    consumed: number
    message?: string
  }> {
    // 先檢查餘額
    const check = await checkTokens(userId, operationType, durationMinutes)

    if (!check.sufficient) {
      return {
        success: false,
        cost: check.cost,
        consumed: 0,
        message: `Token 餘額不足，需要 ${check.cost} Token，目前剩餘 ${check.currentBalance} Token`,
      }
    }

    // 執行消耗
    const result = await consumeTokens(userId, operationType, { durationMinutes })

    if (!result.success) {
      return {
        success: false,
        cost: check.cost,
        consumed: 0,
        message: result.error === 'INSUFFICIENT_BALANCE'
          ? `Token 餘額不足`
          : '扣款失敗，請稍後再試',
      }
    }

    return {
      success: true,
      cost: check.cost,
      consumed: result.consumed,
    }
  }

  function reset() {
    plan.value = null
    subscription.value = null
    tokenBalance.value = 0
    tokensUsedThisPeriod.value = 0
    tokensGrantedThisPeriod.value = 0
    periodEnd.value = ''
    daysRemaining.value = 0
    isInitialized.value = false
  }

  return {
    // State
    plan,
    subscription,
    tokenBalance,
    tokensUsedThisPeriod,
    tokensGrantedThisPeriod,
    periodEnd,
    daysRemaining,
    isLoading,
    isInitialized,

    // Getters
    planCode,
    planName,
    monthlyQuota,
    isPaidPlan,
    tokenPercentage,
    isLowBalance,
    isCriticalBalance,

    // Actions
    hasEnoughTokens,
    loadSubscription,
    refreshBalance,
    checkTokens,
    consumeTokens,
    checkAndConsume,
    reset,
  }
})
