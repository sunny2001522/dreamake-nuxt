// 訂閱方案類型
export type PlanCode = 'free' | 'creator'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending'
export type TransactionType = 'grant' | 'consume' | 'refund' | 'adjust' | 'bonus'

// 訂閱方案
export interface SubscriptionPlan {
  id: string
  code: PlanCode
  name: string
  price: number
  tokensMonthly: number
  features: string[]
  isActive: boolean
  sortOrder: number
}

// 用戶訂閱
export interface UserSubscription {
  id: string
  userId: string
  planCode: PlanCode
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
  fanbarSubscriptionId: string | null
  fanbarCustomerId: string | null
  createdAt: string
  updatedAt: string
}

// Token 餘額
export interface TokenBalance {
  id: string
  userId: string
  balance: number
  tokensUsedThisPeriod: number
  tokensGrantedThisPeriod: number
  periodStart: string
  periodEnd: string
  updatedAt: string
}

// Token 交易記錄
export interface TokenTransaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  balanceAfter: number
  operationType: string | null
  operationId: string | null
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

// Token 消耗配置
export interface TokenCost {
  id: string
  operationType: string
  name: string
  baseCost: number
  perSecondCost: number
  perMinuteCost: number
  maxMinutes: number
  isActive: boolean
}

// 影片模型對應的 Token 成本
export const VIDEO_TOKEN_COSTS = {
  wavespeed: { perSecond: 3.8, perMinute: 231 },
  vidnoz: { perSecond: 0.5, perMinute: 30 },
} as const

export type VideoModel = keyof typeof VIDEO_TOKEN_COSTS

// 語音 TTS Token 成本
// 計算依據：影片(vidnoz) 14.342成本/分鐘 → 0.5 token/秒，語音 0.15成本/分鐘 → 0.00523 token/秒
export const TTS_TOKEN_COST = {
  perSecond: 0.00523,  // 0.15/14.342 * 0.5
  minCost: 1,          // 最低扣除 1 token
} as const

/**
 * 計算語音 TTS 的 Token 消耗
 * @param durationSeconds 語音時長（秒）
 * @returns Token 消耗量（最低 1 token）
 */
export function calculateTtsTokenCost(durationSeconds: number): number {
  const calculated = Math.round(TTS_TOKEN_COST.perSecond * durationSeconds)
  return Math.max(calculated, TTS_TOKEN_COST.minCost)
}

// API 請求/回應類型
export interface TokenBalanceResponse {
  balance: number
  tokensUsedThisPeriod: number
  tokensGrantedThisPeriod: number
  periodStart: string
  periodEnd: string
  daysRemaining: number
  plan: SubscriptionPlan
}

export interface TokenCheckRequest {
  userId: string
  operationType: string
  durationMinutes?: number
}

export interface TokenCheckResponse {
  sufficient: boolean
  cost: number
  currentBalance: number
  balanceAfter?: number
}

export interface TokenConsumeRequest {
  userId: string
  operationType: string
  operationId?: string
  durationMinutes?: number
  description?: string
  metadata?: Record<string, unknown>
}

export interface TokenConsumeResponse {
  success: boolean
  consumed: number
  balanceAfter: number
}

export interface SubscriptionInfoResponse {
  subscription: UserSubscription
  plan: SubscriptionPlan
  tokens: TokenBalanceResponse
}

// 資料庫型別（snake_case）
export interface DbSubscriptionPlan {
  id: string
  code: string
  name: string
  price: number
  tokens_monthly: number
  features: string[]
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface DbUserSubscription {
  id: string
  user_id: string
  plan_code: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancelled_at: string | null
  fanbar_subscription_id: string | null
  fanbar_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface DbTokenBalance {
  id: string
  user_id: string
  balance: number
  tokens_used_this_period: number
  tokens_granted_this_period: number
  period_start: string
  period_end: string
  updated_at: string
}

export interface DbTokenTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  balance_after: number
  operation_type: string | null
  operation_id: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface DbTokenCost {
  id: string
  operation_type: string
  name: string
  base_cost: number
  per_second_cost: number
  per_minute_cost: number
  max_minutes: number
  is_active: boolean
}

// 轉換函數
export function toSubscriptionPlan(db: DbSubscriptionPlan): SubscriptionPlan {
  return {
    id: db.id,
    code: db.code as PlanCode,
    name: db.name,
    price: db.price,
    tokensMonthly: db.tokens_monthly,
    features: db.features,
    isActive: db.is_active,
    sortOrder: db.sort_order,
  }
}

export function toUserSubscription(db: DbUserSubscription): UserSubscription {
  return {
    id: db.id,
    userId: db.user_id,
    planCode: db.plan_code as PlanCode,
    status: db.status as SubscriptionStatus,
    currentPeriodStart: db.current_period_start,
    currentPeriodEnd: db.current_period_end,
    cancelAtPeriodEnd: db.cancel_at_period_end,
    cancelledAt: db.cancelled_at,
    fanbarSubscriptionId: db.fanbar_subscription_id,
    fanbarCustomerId: db.fanbar_customer_id,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export function toTokenBalance(db: DbTokenBalance): TokenBalance {
  return {
    id: db.id,
    userId: db.user_id,
    balance: db.balance,
    tokensUsedThisPeriod: db.tokens_used_this_period,
    tokensGrantedThisPeriod: db.tokens_granted_this_period,
    periodStart: db.period_start,
    periodEnd: db.period_end,
    updatedAt: db.updated_at,
  }
}

export function toTokenTransaction(db: DbTokenTransaction): TokenTransaction {
  return {
    id: db.id,
    userId: db.user_id,
    type: db.type as TransactionType,
    amount: db.amount,
    balanceAfter: db.balance_after,
    operationType: db.operation_type,
    operationId: db.operation_id,
    description: db.description,
    metadata: db.metadata,
    createdAt: db.created_at,
  }
}

export function toTokenCost(db: DbTokenCost): TokenCost {
  return {
    id: db.id,
    operationType: db.operation_type,
    name: db.name,
    baseCost: db.base_cost,
    perSecondCost: db.per_second_cost,
    perMinuteCost: db.per_minute_cost,
    maxMinutes: db.max_minutes,
    isActive: db.is_active,
  }
}

/**
 * 計算影片生成的 Token 消耗
 * @param videoModel 影片模型 (wavespeed | vidnoz)
 * @param durationSeconds 影片時長（秒）
 * @returns Token 消耗量（四捨五入）
 */
export function calculateVideoTokenCost(
  videoModel: VideoModel,
  durationSeconds: number
): number {
  const cost = VIDEO_TOKEN_COSTS[videoModel]
  return Math.round(cost.perSecond * durationSeconds)
}

/**
 * 根據逐字稿長度預估影片時長（秒）
 * 假設平均語速為每分鐘 240 字（每秒 4 字）
 */
export function estimateDurationFromTranscript(transcript: string): number {
  const charCount = transcript.replace(/\s/g, '').length
  const wordsPerMinute = 240 // 每秒 4 字
  const durationMinutes = charCount / wordsPerMinute
  return Math.ceil(durationMinutes * 60) // 轉換為秒
}
