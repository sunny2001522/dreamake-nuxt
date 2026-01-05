import { getFanshipStatus, grantSubscriptionTokens, hasProcessedSubscription } from '../../utils/fanbar/fanbarService'
import { FANBAR_CONFIG } from '~/constants/fanbar'
import { FanshipStatus, type PaymentResult } from '~/types/fanbar'

export default defineEventHandler(async (event): Promise<PaymentResult> => {
  const query = getQuery(event)
  const userId = query.userId as string
  const authHeader = getHeader(event, 'authorization')
  const accessToken = authHeader?.replace('Bearer ', '')

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId is required',
    })
  }

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Authorization header is required',
    })
  }

  try {
    // 從 Fanbar API 取得訂閱狀態
    const fanshipsResponse = await getFanshipStatus(accessToken)

    if (!fanshipsResponse || !fanshipsResponse.fanships || fanshipsResponse.fanships.length === 0) {
      return {
        success: false,
        status: FanshipStatus.Failed,
        message: '無訂閱記錄',
      }
    }

    // 找到對應的訂閱
    const subscription = fanshipsResponse.fanships[0]

    // 根據狀態處理
    switch (subscription.subscriptionStatus) {
      case FanshipStatus.Active: {
        // 檢查是否已處理過（避免重複發放）
        const alreadyProcessed = await hasProcessedSubscription(userId, subscription.fanshipPlanId)

        if (alreadyProcessed) {
          return {
            success: true,
            status: FanshipStatus.Active,
            message: '訂閱已啟用',
            tokensAdded: 0,
          }
        }

        // 發放 Token
        const result = await grantSubscriptionTokens(
          userId,
          FANBAR_CONFIG.tokensPerSubscription,
          subscription.fanshipPlanId,
          `訂閱創作者方案，發放 ${FANBAR_CONFIG.tokensPerSubscription} Token`
        )

        if (!result.success) {
          return {
            success: false,
            status: FanshipStatus.Failed,
            message: '發放 Token 失敗，請聯繫客服',
          }
        }

        return {
          success: true,
          status: FanshipStatus.Active,
          message: '訂閱成功',
          tokensAdded: FANBAR_CONFIG.tokensPerSubscription,
        }
      }

      case FanshipStatus.Cancelled:
        return {
          success: false,
          status: FanshipStatus.Cancelled,
          message: '訂閱已取消',
        }

      case FanshipStatus.Failed:
      default:
        return {
          success: false,
          status: FanshipStatus.Failed,
          message: '付款失敗，請重新嘗試',
        }
    }
  } catch (error) {
    console.error('[Fanbar Subscription API] Error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to verify subscription status',
    })
  }
})
