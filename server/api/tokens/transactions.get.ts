import { getTransactions } from '../../utils/subscription/tokenService'
import type { DbTokenTransaction, TokenTransaction } from '~/types/subscription'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string
  const limit = parseInt(query.limit as string) || 20
  const offset = parseInt(query.offset as string) || 0
  const type = query.type as string | undefined

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId is required',
    })
  }

  const { transactions: dbTransactions, total } = await getTransactions(userId, {
    limit,
    offset,
    type,
  })

  const transactions: TokenTransaction[] = dbTransactions.map((db: DbTokenTransaction) => ({
    id: db.id,
    userId: db.user_id,
    type: db.type as 'grant' | 'consume' | 'refund' | 'adjust' | 'bonus',
    amount: db.amount,
    balanceAfter: db.balance_after,
    operationType: db.operation_type,
    operationId: db.operation_id,
    description: db.description,
    metadata: db.metadata,
    createdAt: db.created_at,
  }))

  return {
    transactions,
    total,
    limit,
    offset,
  }
})
