import { getSupabaseAdmin } from '../supabase-admin'
import { getTokenBalance, initializeUserSubscription } from '../subscription/tokenService'
import type { FanshipsResponse, FanshipItem, FanshipStatus } from '~/types/fanbar'

/**
 * 從 Fanbar API 取得用戶訂閱狀態
 */
export async function getFanshipStatus(accessToken: string): Promise<FanshipsResponse | null> {
  const config = useRuntimeConfig()
  const fanbarApiUrl = config.fanbarApiUrl

  try {
    const response = await $fetch<FanshipsResponse>(`${fanbarApiUrl}/api/Users/me/Fanships`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return response
  } catch (error) {
    console.error('[FanbarService] Failed to get fanship status:', error)
    return null
  }
}

/**
 * 發放訂閱成功後的 Token
 * 流程：先清除現有餘額（記錄 clear 交易），再發放新 Token（記錄 grant 交易）
 */
export async function grantSubscriptionTokens(
  userId: string,
  amount: number,
  fanshipPlanId: string,
  description?: string
): Promise<{ success: boolean; newBalance: number }> {
  const supabase = getSupabaseAdmin()

  // 獲取當前餘額
  let balance = await getTokenBalance(userId)

  if (!balance) {
    const result = await initializeUserSubscription(userId)
    balance = result.balance
  }

  // 計算新的週期結束時間（30天後）
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  // 1. 先記錄清除交易（如果有餘額）
  if (balance.balance > 0) {
    await supabase.from('token_transactions').insert({
      user_id: userId,
      type: 'clear',
      amount: -balance.balance,
      balance_after: 0,
      description: `購買新方案，清除舊餘額 ${balance.balance} Token`,
      metadata: {
        source: 'new_subscription',
        fanshipPlanId,
      },
    })
  }

  // 2. 記錄發放交易
  await supabase.from('token_transactions').insert({
    user_id: userId,
    type: 'grant',
    amount: amount,
    balance_after: amount,
    description: description || `訂閱成功，發放 ${amount} Token`,
    metadata: {
      source: 'fanbar_subscription',
      fanshipPlanId,
    },
  })

  // 3. 更新餘額為新發放的數量（覆蓋，不是累加）
  const { error: balanceError } = await supabase
    .from('token_balances')
    .update({
      balance: amount,
      tokens_granted_this_period: amount,
      tokens_used_this_period: 0,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)

  if (balanceError) {
    console.error('[FanbarService] Failed to update token balance:', balanceError)
    return { success: false, newBalance: balance.balance }
  }

  // 4. 更新用戶訂閱狀態
  const { error: subError } = await supabase
    .from('user_subscriptions')
    .update({
      plan_code: 'creator',
      status: 'active',
      fanbar_subscription_id: fanshipPlanId,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)

  if (subError) {
    console.error('[FanbarService] Failed to update subscription:', subError)
  }

  return { success: true, newBalance: amount }
}

/**
 * 檢查用戶是否已處理過此訂閱（避免重複發放）
 */
export async function hasProcessedSubscription(
  userId: string,
  fanshipPlanId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('user_subscriptions')
    .select('fanbar_subscription_id')
    .eq('user_id', userId)
    .single()

  return data?.fanbar_subscription_id === fanshipPlanId
}
