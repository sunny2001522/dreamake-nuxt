import {
  getTokenBalance,
  getUserPlan,
  initializeUserSubscription,
} from '../../utils/subscription/tokenService'
import type { TokenBalanceResponse } from '~/types/subscription'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId is required',
    })
  }

  // 獲取 Token 餘額
  let balance = await getTokenBalance(userId)

  // 新用戶自動初始化
  if (!balance) {
    const result = await initializeUserSubscription(userId)
    balance = result.balance
  }

  // 獲取方案
  const plan = await getUserPlan(userId)
  if (!plan) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch plan',
    })
  }

  // 計算剩餘天數
  const now = new Date()
  const periodEnd = new Date(balance.periodEnd)
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const response: TokenBalanceResponse = {
    balance: balance.balance,
    tokensUsedThisPeriod: balance.tokensUsedThisPeriod,
    tokensGrantedThisPeriod: balance.tokensGrantedThisPeriod,
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd,
    daysRemaining,
    plan,
  }

  return response
})
