/**
 * Fanbar 訂閱狀態
 */
export enum FanshipStatus {
  Active = 1,      // 啟用中 (訂閱中)
  Cancelled = 2,   // 已取消訂閱
  Failed = 3,      // 付款失敗
}

/**
 * Fanbar API 回傳的訂閱項目
 */
export interface FanshipItem {
  fanshipPlanId: string
  homepageId: string
  homepageTitle: string
  homepageAvatarImgUrl: string
  fanshipPlanName: string
  fanshipPlanPrice: number
  fanshipPlanAuthDay: number
  subscriptionStatus: FanshipStatus
  chargeTime: number
  dueTime: number
  paymentInfo: {
    lastFourDigits: string
  }
  payTypeInfo: {
    name: string
  }
  changePaymentUrl: string
}

/**
 * Fanbar /api/Users/me/Fanships API 回傳格式
 */
export interface FanshipsResponse {
  fanships: FanshipItem[]
}

/**
 * 付款驗證結果
 */
export interface PaymentResult {
  success: boolean
  status: FanshipStatus
  message: string
  tokensAdded?: number
}

/**
 * 結帳 URL 參數
 */
export interface CheckoutParams {
  productType: string
  functionId: string
  platform: string
  returnUrl: string
}
