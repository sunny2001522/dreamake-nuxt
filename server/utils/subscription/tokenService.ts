import { getSupabaseAdmin } from '../supabase-admin'
import type {
  DbSubscriptionPlan,
  DbUserSubscription,
  DbTokenBalance,
  DbTokenCost,
  TokenBalance,
  SubscriptionPlan,
  toSubscriptionPlan,
  toTokenBalance,
} from '~/types/subscription'
import { VIDEO_TOKEN_COSTS } from '~/types/subscription'

/**
 * 計算操作的 Token 消耗量
 */
export async function calculateTokenCost(
  operationType: string,
  durationMinutes?: number
): Promise<number> {
  const supabase = getSupabaseAdmin()

  const { data: cost, error } = await supabase
    .from('token_costs')
    .select('*')
    .eq('operation_type', operationType)
    .eq('is_active', true)
    .single()

  if (error || !cost) {
    console.warn(`[TokenService] No cost config for ${operationType}, using default 1`)
    return 1
  }

  const dbCost = cost as DbTokenCost

  // 固定費用（無按時長計算）
  if (!dbCost.per_minute_cost || !durationMinutes) {
    return dbCost.base_cost
  }

  // 按時長計算：基礎費用 + (分鐘數 × 每分鐘費用)
  const minutes = Math.min(Math.ceil(durationMinutes), dbCost.max_minutes)
  const extraCost = Math.max(0, minutes - 1) * dbCost.per_minute_cost

  return dbCost.base_cost + extraCost
}

/**
 * 計算影片生成的 Token 消耗量（按秒計費）
 * @param videoModel 影片模型 (wavespeed | vidnoz)
 * @param durationSeconds 影片時長（秒）
 * @returns Token 消耗量（四捨五入）
 */
export function calculateVideoTokenCost(
  videoModel: 'wavespeed' | 'vidnoz',
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

/**
 * 獲取用戶 Token 餘額
 */
export async function getTokenBalance(userId: string): Promise<TokenBalance | null> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('token_balances')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // 沒有記錄，需要初始化
      return null
    }
    console.error('[TokenService] Error fetching balance:', error)
    return null
  }

  const dbBalance = data as DbTokenBalance

  // 檢查是否需要重置週期
  const now = new Date()
  const periodEnd = new Date(dbBalance.period_end)

  if (now > periodEnd) {
    return await renewUserPeriod(userId)
  }

  return {
    id: dbBalance.id,
    userId: dbBalance.user_id,
    balance: dbBalance.balance,
    tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
    tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
    periodStart: dbBalance.period_start,
    periodEnd: dbBalance.period_end,
    updatedAt: dbBalance.updated_at,
  }
}

/**
 * 獲取用戶訂閱方案
 */
export async function getUserPlan(userId: string): Promise<SubscriptionPlan | null> {
  const supabase = getSupabaseAdmin()

  // 先獲取用戶訂閱
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_code')
    .eq('user_id', userId)
    .single()

  const planCode = subscription?.plan_code || 'free'

  // 獲取方案詳情
  const { data: plan, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('code', planCode)
    .single()

  if (error || !plan) {
    return null
  }

  const dbPlan = plan as DbSubscriptionPlan
  return {
    id: dbPlan.id,
    code: dbPlan.code as 'free' | 'creator',
    name: dbPlan.name,
    price: dbPlan.price,
    tokensMonthly: dbPlan.tokens_monthly,
    features: dbPlan.features,
    isActive: dbPlan.is_active,
    sortOrder: dbPlan.sort_order,
  }
}

/**
 * 初始化新用戶的訂閱和 Token
 * 處理並發請求，避免 duplicate key 錯誤
 */
export async function initializeUserSubscription(userId: string): Promise<{
  subscription: DbUserSubscription
  balance: TokenBalance
}> {
  const supabase = getSupabaseAdmin()

  // 先檢查是否已有訂閱（處理並發請求）
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existingSub) {
    // 已存在訂閱，獲取餘額並返回
    const existingBalance = await getTokenBalance(userId)
    if (existingBalance) {
      return {
        subscription: existingSub as DbUserSubscription,
        balance: existingBalance,
      }
    }
    // 如果有訂閱但沒餘額，繼續建立餘額
  }

  const now = new Date()
  // 免費方案有效期為一個月
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  // 獲取免費方案的 Token 配額
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('tokens_monthly')
    .eq('code', 'free')
    .single()

  const tokensMonthly = freePlan?.tokens_monthly || 100

  let subscription: DbUserSubscription

  // 只有在沒有現有訂閱時才建立
  if (!existingSub) {
    // 使用 upsert 來處理並發情況
    const { data: newSub, error: subError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_code: 'free',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (subError) {
      // 如果 upsert 也失敗，嘗試查詢現有記錄（可能是並發請求剛插入）
      const { data: fallbackSub } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (fallbackSub) {
        subscription = fallbackSub as DbUserSubscription
      } else {
        throw new Error(`Failed to create subscription: ${subError.message}`)
      }
    } else {
      subscription = newSub as DbUserSubscription
    }
  } else {
    subscription = existingSub as DbUserSubscription
  }

  // 檢查是否已有餘額
  const { data: existingBal } = await supabase
    .from('token_balances')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existingBal) {
    const dbBalance = existingBal as DbTokenBalance
    return {
      subscription,
      balance: {
        id: dbBalance.id,
        userId: dbBalance.user_id,
        balance: dbBalance.balance,
        tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
        tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
        periodStart: dbBalance.period_start,
        periodEnd: dbBalance.period_end,
        updatedAt: dbBalance.updated_at,
      },
    }
  }

  // 建立 Token 餘額（使用 upsert）
  const { data: balance, error: balError } = await supabase
    .from('token_balances')
    .upsert({
      user_id: userId,
      balance: tokensMonthly,
      tokens_used_this_period: 0,
      tokens_granted_this_period: tokensMonthly,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single()

  if (balError) {
    // 如果失敗，嘗試查詢現有記錄
    const { data: fallbackBal } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fallbackBal) {
      const dbBalance = fallbackBal as DbTokenBalance
      return {
        subscription,
        balance: {
          id: dbBalance.id,
          userId: dbBalance.user_id,
          balance: dbBalance.balance,
          tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
          tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
          periodStart: dbBalance.period_start,
          periodEnd: dbBalance.period_end,
          updatedAt: dbBalance.updated_at,
        },
      }
    }
    throw new Error(`Failed to create token balance: ${balError.message}`)
  }

  // 記錄初始發放交易
  await supabase.from('token_transactions').insert({
    user_id: userId,
    type: 'grant',
    amount: tokensMonthly,
    balance_after: tokensMonthly,
    description: `初始發放 ${tokensMonthly} Token (免費方案)`,
  })

  const dbBalance = balance as DbTokenBalance

  return {
    subscription,
    balance: {
      id: dbBalance.id,
      userId: dbBalance.user_id,
      balance: dbBalance.balance,
      tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
      tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
      periodStart: dbBalance.period_start,
      periodEnd: dbBalance.period_end,
      updatedAt: dbBalance.updated_at,
    },
  }
}

/**
 * 重置用戶週期 - 付費方案到期時清除所有 Token
 */
async function renewUserPeriod(userId: string): Promise<TokenBalance> {
  const supabase = getSupabaseAdmin()

  // 獲取用戶方案
  const plan = await getUserPlan(userId)

  // 免費方案不重置 Token，直接返回現有餘額
  if (plan?.code === 'free') {
    const { data } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (data) {
      const dbBalance = data as DbTokenBalance
      return {
        id: dbBalance.id,
        userId: dbBalance.user_id,
        balance: dbBalance.balance,
        tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
        tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
        periodStart: dbBalance.period_start,
        periodEnd: dbBalance.period_end,
        updatedAt: dbBalance.updated_at,
      }
    }
  }

  const now = new Date()

  // 付費方案：週期結束，清除所有 Token 為 0
  // 先取得當前餘額，記錄清除交易
  const { data: currentBalanceData } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (currentBalanceData && currentBalanceData.balance > 0) {
    // 記錄過期清除交易
    await supabase.from('token_transactions').insert({
      user_id: userId,
      type: 'expire',
      amount: -currentBalanceData.balance,
      balance_after: 0,
      description: `方案到期，清除 ${currentBalanceData.balance} Token`,
    })
  }

  // 更新餘額為 0（不自動發放，等待用戶重新購買）
  const { data, error } = await supabase
    .from('token_balances')
    .update({
      balance: 0,
      tokens_used_this_period: 0,
      tokens_granted_this_period: 0,
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to renew period: ${error.message}`)
  }

  // 更新訂閱狀態為已過期
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)

  const dbBalance = data as DbTokenBalance

  return {
    id: dbBalance.id,
    userId: dbBalance.user_id,
    balance: dbBalance.balance,
    tokensUsedThisPeriod: dbBalance.tokens_used_this_period,
    tokensGrantedThisPeriod: dbBalance.tokens_granted_this_period,
    periodStart: dbBalance.period_start,
    periodEnd: dbBalance.period_end,
    updatedAt: dbBalance.updated_at,
  }
}

/**
 * 檢查用戶是否有足夠的 Token
 */
export async function checkSufficientBalance(
  userId: string,
  operationType: string,
  durationMinutes?: number
): Promise<{
  sufficient: boolean
  cost: number
  currentBalance: number
  balanceAfter?: number
}> {
  const cost = await calculateTokenCost(operationType, durationMinutes)

  let balance = await getTokenBalance(userId)

  // 新用戶自動初始化
  if (!balance) {
    const result = await initializeUserSubscription(userId)
    balance = result.balance
  }

  if (balance.balance >= cost) {
    return {
      sufficient: true,
      cost,
      currentBalance: balance.balance,
      balanceAfter: balance.balance - cost,
    }
  }

  return {
    sufficient: false,
    cost,
    currentBalance: balance.balance,
  }
}

/**
 * 消耗 Token
 * @param customCost - 可選的自定義成本，如果提供則不從資料庫查詢
 */
export async function consumeTokens(params: {
  userId: string
  operationType: string
  operationId?: string
  durationMinutes?: number
  description?: string
  metadata?: Record<string, unknown>
  customCost?: number
}): Promise<{
  success: boolean
  consumed: number
  balanceAfter: number
  error?: string
}> {
  const { userId, operationType, operationId, durationMinutes, description, metadata, customCost } = params
  const supabase = getSupabaseAdmin()

  const cost = customCost ?? await calculateTokenCost(operationType, durationMinutes)

  // 獲取當前餘額
  let balance = await getTokenBalance(userId)

  if (!balance) {
    const result = await initializeUserSubscription(userId)
    balance = result.balance
  }

  if (balance.balance < cost) {
    return {
      success: false,
      consumed: 0,
      balanceAfter: balance.balance,
      error: 'INSUFFICIENT_BALANCE',
    }
  }

  const newBalance = balance.balance - cost
  const newUsed = balance.tokensUsedThisPeriod + cost

  // 更新餘額
  const { error: updateError } = await supabase
    .from('token_balances')
    .update({
      balance: newBalance,
      tokens_used_this_period: newUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    return {
      success: false,
      consumed: 0,
      balanceAfter: balance.balance,
      error: updateError.message,
    }
  }

  // 記錄交易
  await supabase.from('token_transactions').insert({
    user_id: userId,
    type: 'consume',
    amount: -cost,
    balance_after: newBalance,
    operation_type: operationType,
    operation_id: operationId || null,
    description: description || `消耗 ${cost} Token: ${operationType}`,
    metadata: metadata || {},
  })

  return {
    success: true,
    consumed: cost,
    balanceAfter: newBalance,
  }
}

/**
 * 退還 Token（操作失敗時）
 */
export async function refundTokens(params: {
  userId: string
  operationType: string
  operationId?: string
  amount: number
  reason: string
}): Promise<{
  success: boolean
  refunded: number
  balanceAfter: number
}> {
  const { userId, operationType, operationId, amount, reason } = params
  const supabase = getSupabaseAdmin()

  const balance = await getTokenBalance(userId)

  if (!balance) {
    return { success: false, refunded: 0, balanceAfter: 0 }
  }

  const newBalance = balance.balance + amount
  const newUsed = Math.max(0, balance.tokensUsedThisPeriod - amount)

  // 更新餘額
  const { error } = await supabase
    .from('token_balances')
    .update({
      balance: newBalance,
      tokens_used_this_period: newUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    return { success: false, refunded: 0, balanceAfter: balance.balance }
  }

  // 記錄退還交易
  await supabase.from('token_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: amount,
    balance_after: newBalance,
    operation_type: operationType,
    operation_id: operationId || null,
    description: `退還 ${amount} Token: ${reason}`,
  })

  return {
    success: true,
    refunded: amount,
    balanceAfter: newBalance,
  }
}

/**
 * 獲取用戶交易記錄
 */
export async function getTransactions(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<{ transactions: any[]; total: number }> {
  const supabase = getSupabaseAdmin()
  const limit = options?.limit || 20
  const offset = options?.offset || 0

  let query = supabase
    .from('token_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.type) {
    query = query.eq('type', options.type)
  }

  const { data, count, error } = await query

  if (error) {
    return { transactions: [], total: 0 }
  }

  return {
    transactions: data || [],
    total: count || 0,
  }
}
