import { refundTokens } from '../../utils/subscription/tokenService'

interface RefundRequest {
  userId: string
  operationType: string
  operationId?: string
  amount: number
  reason: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RefundRequest>(event)

  if (!body.userId || !body.amount || !body.reason) {
    throw createError({
      statusCode: 400,
      message: 'userId, amount, and reason are required',
    })
  }

  const result = await refundTokens({
    userId: body.userId,
    operationType: body.operationType || 'unknown',
    operationId: body.operationId,
    amount: body.amount,
    reason: body.reason,
  })

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: 'Failed to refund tokens',
    })
  }

  return {
    success: true,
    refunded: result.refunded,
    balanceAfter: result.balanceAfter,
  }
})
