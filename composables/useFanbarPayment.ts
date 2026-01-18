import { FANBAR_CONFIG, FANBAR_STORAGE_KEY } from '~/constants/fanbar'
import { FanshipStatus, type PaymentResult } from '~/types/fanbar'

export const useFanbarPayment = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const subscriptionStore = useSubscriptionStore()
  const toastStore = useToastStore()

  /**
   * 導向 Fanbar 結帳頁面
   */
  const redirectToCheckout = (returnPath: string = '/pricing') => {
    if (!authStore.user) {
      throw new Error('User must be logged in')
    }

    // 儲存返回路徑
    if (import.meta.client) {
      localStorage.setItem(FANBAR_STORAGE_KEY, returnPath)
    }

    // 組建結帳 URL
    const baseDomain = config.public.baseDomain || window.location.origin
    const returnUrl = encodeURIComponent(`${baseDomain}/payment/callback`)

    const checkoutUrl = new URL(config.public.fanbarCheckoutUrl)
    checkoutUrl.searchParams.set('productType', FANBAR_CONFIG.productType)
    checkoutUrl.searchParams.set('functionId', config.public.fanbarFunctionId)
    checkoutUrl.searchParams.set('platform', FANBAR_CONFIG.platform)
    checkoutUrl.searchParams.set('returnUrl', returnUrl)

    // 導向結帳
    window.location.href = checkoutUrl.toString()
  }

  /**
   * 處理付款回調
   */
  const handlePaymentCallback = async (): Promise<PaymentResult> => {
    const userId = authStore.authInfo.sub

    if (!userId) {
      return {
        success: false,
        status: FanshipStatus.Failed,
        message: '用戶未登入',
      }
    }

    const accessToken = authStore.tokenInfo.access_token

    if (!accessToken) {
      return {
        success: false,
        status: FanshipStatus.Failed,
        message: '授權失效，請重新登入',
      }
    }

    try {
      // 呼叫後端 API 驗證訂閱狀態
      const result = await $fetch<PaymentResult>('/api/fanbar/subscription', {
        query: { userId },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      // 成功時更新本地狀態
      if (result.success) {
        await subscriptionStore.refreshBalance(userId)
        toastStore.success(`訂閱成功！已增加 ${result.tokensAdded} Token`)
      }

      return result
    } catch (error) {
      console.error('[useFanbarPayment] Payment callback error:', error)
      return {
        success: false,
        status: FanshipStatus.Failed,
        message: '驗證訂閱狀態失敗',
      }
    }
  }

  /**
   * 取得儲存的返回路徑
   */
  const getReturnPath = (): string => {
    if (!import.meta.client) {
      return '/pricing'
    }

    const stored = localStorage.getItem(FANBAR_STORAGE_KEY)
    localStorage.removeItem(FANBAR_STORAGE_KEY)
    return stored || '/pricing'
  }

  /**
   * 取得結帳 URL（用於失敗後重試）
   */
  const getCheckoutUrl = (): string => {
    const baseDomain = config.public.baseDomain || (import.meta.client ? window.location.origin : '')
    const returnUrl = encodeURIComponent(`${baseDomain}/payment/callback`)

    const checkoutUrl = new URL(config.public.fanbarCheckoutUrl)
    checkoutUrl.searchParams.set('productType', FANBAR_CONFIG.productType)
    checkoutUrl.searchParams.set('functionId', config.public.fanbarFunctionId)
    checkoutUrl.searchParams.set('platform', FANBAR_CONFIG.platform)
    checkoutUrl.searchParams.set('returnUrl', returnUrl)

    return checkoutUrl.toString()
  }

  return {
    redirectToCheckout,
    handlePaymentCallback,
    getReturnPath,
    getCheckoutUrl,
  }
}
