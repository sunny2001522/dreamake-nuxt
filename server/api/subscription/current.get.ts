import { getSupabaseAdmin } from '../../utils/supabase-admin'
import {
  getTokenBalance,
  getUserPlan,
  initializeUserSubscription,
} from '../../utils/subscription/tokenService'
import type { DbUserSubscription, UserSubscription, SubscriptionInfoResponse } from '~/types/subscription'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId is required',
    })
  }

  const supabase = getSupabaseAdmin()

  // 獲取用戶訂閱
  let { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  // 新用戶自動初始化
  if (error?.code === 'PGRST116' || !subscription) {
    const result = await initializeUserSubscription(userId)
    subscription = result.subscription
  } else if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch subscription',
    })
  }

  const dbSub = subscription as DbUserSubscription

  // 獲取方案詳情
  const plan = await getUserPlan(userId)
  if (!plan) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch plan',
    })
  }

  // 獲取 Token 餘額
  let balance = await getTokenBalance(userId)
  if (!balance) {
    const result = await initializeUserSubscription(userId)
    balance = result.balance
  }

  // 計算剩餘天數
  const now = new Date()
  const periodEnd = new Date(balance.periodEnd)
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const response: SubscriptionInfoResponse = {
    subscription: {
      id: dbSub.id,
      userId: dbSub.user_id,
      planCode: dbSub.plan_code as 'free' | 'creator',
      status: dbSub.status as 'active' | 'cancelled' | 'expired' | 'pending',
      currentPeriodStart: dbSub.current_period_start,
      currentPeriodEnd: dbSub.current_period_end,
      cancelAtPeriodEnd: dbSub.cancel_at_period_end,
      cancelledAt: dbSub.cancelled_at,
      fanbarSubscriptionId: dbSub.fanbar_subscription_id,
      fanbarCustomerId: dbSub.fanbar_customer_id,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
    },
    plan,
    tokens: {
      balance: balance.balance,
      tokensUsedThisPeriod: balance.tokensUsedThisPeriod,
      tokensGrantedThisPeriod: balance.tokensGrantedThisPeriod,
      periodStart: balance.periodStart,
      periodEnd: balance.periodEnd,
      daysRemaining,
      plan,
    },
  }

  return response
})
