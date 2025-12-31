import { consumeTokens } from '../../utils/subscription/tokenService'
import type { TokenConsumeRequest, TokenConsumeResponse } from '~/types/subscription'

export default defineEventHandler(async (event) => {
  const body = await readBody<TokenConsumeRequest>(event)

  if (!body.userId || !body.operationType) {
    throw createError({
      statusCode: 400,
      message: 'userId and operationType are required',
    })
  }

  const result = await consumeTokens({
    userId: body.userId,
    operationType: body.operationType,
    operationId: body.operationId,
    durationMinutes: body.durationMinutes,
    description: body.description,
    metadata: body.metadata,
  })

  if (!result.success) {
    if (result.error === 'INSUFFICIENT_BALANCE') {
      throw createError({
        statusCode: 402, // Payment Required
        message: 'Token 餘額不足',
        data: {
          error: 'INSUFFICIENT_BALANCE',
          currentBalance: result.balanceAfter,
          upgradeUrl: '/pricing',
        },
      })
    }

    throw createError({
      statusCode: 500,
      message: result.error || 'Failed to consume tokens',
    })
  }

  const response: TokenConsumeResponse = {
    success: true,
    consumed: result.consumed,
    balanceAfter: result.balanceAfter,
  }

  return response
})
