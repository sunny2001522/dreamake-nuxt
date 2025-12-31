import { checkSufficientBalance } from '../../utils/subscription/tokenService'
import type { TokenCheckRequest, TokenCheckResponse } from '~/types/subscription'

export default defineEventHandler(async (event) => {
  const body = await readBody<TokenCheckRequest>(event)

  if (!body.userId || !body.operationType) {
    throw createError({
      statusCode: 400,
      message: 'userId and operationType are required',
    })
  }

  const result = await checkSufficientBalance(
    body.userId,
    body.operationType,
    body.durationMinutes
  )

  const response: TokenCheckResponse = {
    sufficient: result.sufficient,
    cost: result.cost,
    currentBalance: result.currentBalance,
    balanceAfter: result.balanceAfter,
  }

  return response
})
