import { getSupabaseAdmin } from '../../utils/supabase-admin'
import type { DbSubscriptionPlan, SubscriptionPlan } from '~/types/subscription'

export default defineEventHandler(async () => {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch subscription plans',
    })
  }

  const plans: SubscriptionPlan[] = (data as DbSubscriptionPlan[]).map((db) => ({
    id: db.id,
    code: db.code as 'free' | 'creator',
    name: db.name,
    price: db.price,
    tokensMonthly: db.tokens_monthly,
    features: db.features,
    isActive: db.is_active,
    sortOrder: db.sort_order,
  }))

  return { plans }
})
