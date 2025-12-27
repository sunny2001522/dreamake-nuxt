/**
 * GET /api/admin/usage
 * Returns usage dashboard data for all services
 */

import { validateAdminAccess } from '~/server/utils/admin/auth'
import { buildServiceQuotas, calculateSummary } from '~/server/utils/admin/quotaServices'
import type { UsageDashboardData } from '~/types/admin'

export default defineEventHandler(async (event): Promise<UsageDashboardData> => {
  const userEmail = getHeader(event, 'x-user-email')
  const { authorized, error } = validateAdminAccess(userEmail)

  if (!authorized) {
    throw createError({
      statusCode: error!.statusCode,
      message: error!.message,
    })
  }

  try {
    const services = await buildServiceQuotas()
    const summary = calculateSummary(services)

    return {
      services,
      summary,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[Admin Usage API] Error:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch usage data',
    })
  }
})
