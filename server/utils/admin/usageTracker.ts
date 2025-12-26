/**
 * API Usage Tracking utilities
 * Logs API usage to the api_usage table for quota tracking
 */

import { getSupabaseAdmin } from '../supabase-admin'

interface TrackUsageParams {
  serviceId: string
  operation: string
  quantity?: number
  userId?: string
  metadata?: Record<string, unknown>
}

/**
 * Track API usage by inserting a record into the api_usage table
 * This should be called after successful API operations
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    await supabase.from('api_usage').insert({
      service_id: params.serviceId,
      operation: params.operation,
      quantity: params.quantity ?? 1,
      user_id: params.userId ?? null,
      metadata: params.metadata ?? {},
    })
  } catch (error) {
    // Log error but don't throw - usage tracking should not break main flow
    console.error('[UsageTracker] Failed to track usage:', error)
  }
}

/**
 * Get usage statistics for a specific service within a date range
 */
export async function getServiceUsage(
  serviceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ total: number; records: number }> {
  try {
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('api_usage')
      .select('quantity')
      .eq('service_id', serviceId)

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('[UsageTracker] Failed to get service usage:', error)
      return { total: 0, records: 0 }
    }

    const total = (data || []).reduce((sum, row) => sum + (row.quantity || 0), 0)
    return { total, records: data?.length || 0 }
  } catch (error) {
    console.error('[UsageTracker] Failed to get service usage:', error)
    return { total: 0, records: 0 }
  }
}

/**
 * Get current month usage for a service (for monthly billing)
 */
export async function getCurrentMonthUsage(serviceId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { total } = await getServiceUsage(serviceId, startOfMonth)
  return total
}

/**
 * Get all-time usage for a service (for cumulative billing)
 */
export async function getAllTimeUsage(serviceId: string): Promise<number> {
  const { total } = await getServiceUsage(serviceId)
  return total
}

/**
 * Get usage for all services grouped by service_id
 */
export async function getAllServicesUsage(): Promise<Record<string, { monthly: number; allTime: number }>> {
  try {
    const supabase = getSupabaseAdmin()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('api_usage')
      .select('service_id, quantity, created_at')

    if (error) {
      console.error('[UsageTracker] Failed to get all services usage:', error)
      return {}
    }

    const result: Record<string, { monthly: number; allTime: number }> = {}

    for (const row of data || []) {
      if (!result[row.service_id]) {
        result[row.service_id] = { monthly: 0, allTime: 0 }
      }

      result[row.service_id].allTime += row.quantity || 0

      if (new Date(row.created_at) >= startOfMonth) {
        result[row.service_id].monthly += row.quantity || 0
      }
    }

    return result
  } catch (error) {
    console.error('[UsageTracker] Failed to get all services usage:', error)
    return {}
  }
}
