/**
 * POST /api/admin/quota-settings
 * Update quota settings in database
 */

import { validateAdminAccess } from '~/server/utils/admin/auth'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { DbQuotaSetting } from '~/types/admin'

interface QuotaSettingUpdate {
  total_quota?: number
  billing_type?: 'monthly' | 'cumulative'
  plan_name?: string
  billing_cycle_start?: string
  billing_cycle_days?: number
}

interface RequestBody {
  settings: Record<string, QuotaSettingUpdate>
}

export default defineEventHandler(async (event): Promise<{
  success: boolean
  results: { service_id: string; success: boolean; error?: string }[]
}> => {
  const userEmail = getHeader(event, 'x-user-email')
  const { authorized, error } = validateAdminAccess(userEmail)

  if (!authorized) {
    throw createError({
      statusCode: error!.statusCode,
      message: error!.message,
    })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.settings || typeof body.settings !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Settings object is required',
    })
  }

  const supabase = getSupabaseAdmin()
  const results: { service_id: string; success: boolean; error?: string }[] = []

  for (const [serviceId, updates] of Object.entries(body.settings)) {
    try {
      // First, get existing setting
      const { data: existing } = await supabase
        .from('quota_settings')
        .select('*')
        .eq('service_id', serviceId)
        .single()

      // Merge with updates
      const merged: DbQuotaSetting = {
        service_id: serviceId,
        quota_type: existing?.quota_type ?? 'requests',
        total_quota: updates.total_quota ?? existing?.total_quota ?? 0,
        billing_type: updates.billing_type ?? existing?.billing_type ?? 'monthly',
        plan_name: updates.plan_name ?? existing?.plan_name ?? null,
        billing_cycle_start: updates.billing_cycle_start ?? existing?.billing_cycle_start ?? null,
        billing_cycle_days: updates.billing_cycle_days ?? existing?.billing_cycle_days ?? 30,
        updated_at: new Date().toISOString(),
      }

      // Upsert the setting
      const { error: upsertError } = await supabase
        .from('quota_settings')
        .upsert(merged, { onConflict: 'service_id' })

      if (upsertError) {
        console.error(`[Quota Settings] Failed to update ${serviceId}:`, upsertError)
        results.push({ service_id: serviceId, success: false, error: upsertError.message })
      } else {
        results.push({ service_id: serviceId, success: true })
      }
    } catch (err: any) {
      console.error(`[Quota Settings] Error updating ${serviceId}:`, err)
      results.push({ service_id: serviceId, success: false, error: err.message })
    }
  }

  return {
    success: results.every(r => r.success),
    results,
  }
})
