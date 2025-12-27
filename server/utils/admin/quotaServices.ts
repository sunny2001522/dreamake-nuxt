/**
 * Quota Services - Query usage and quotas from various sources
 */

import { getSupabaseAdmin } from '../supabase-admin'
import { getAllServicesUsage } from './usageTracker'
import type {
  ServiceQuota,
  QuotaItem,
  QuotaStatus,
  DbQuotaSetting,
  TopMediaiKeyInfo,
  WaveSpeedBalance,
} from '~/types/admin'
import {
  SERVICE_CONFIGS,
  TOPMEDIAI_CLONE_PLANS,
} from '~/types/admin'

const TOPMEDIAI_BASE_URL = 'https://api.topmediai.com/v1'
const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3'

/**
 * Get TopMediai API Key Info - includes remaining TTS characters and clone voices
 * API: GET /v1/get_api_key_info
 */
export async function getTopMediaiKeyInfo(): Promise<{
  data: TopMediaiKeyInfo | null
  error?: string
}> {
  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    return { data: null, error: 'TopMediai API key not configured' }
  }

  try {
    const response = await fetch(`${TOPMEDIAI_BASE_URL}/get_api_key_info`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return { data: null, error: `API error: ${response.status}` }
    }

    const data = await response.json()
    console.log('[QuotaServices] TopMediai key info:', data)

    return {
      data: {
        key_words_counts: data.key_words_counts ?? 0,
        key_clone_voices: data.key_clone_voices ?? 0,
      },
    }
  } catch (error) {
    console.error('[QuotaServices] TopMediai API error:', error)
    return { data: null, error: String(error) }
  }
}

/**
 * Get TopMediai clone count via API (counts existing clones)
 */
export async function getTopMediaiCloneCount(): Promise<{
  used: number
  error?: string
}> {
  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    return { used: 0, error: 'TopMediai API key not configured' }
  }

  try {
    const response = await fetch(`${TOPMEDIAI_BASE_URL}/clone_voices_list`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return { used: 0, error: `API error: ${response.status}` }
    }

    const data = await response.json()
    // Count the number of cloned voices - API returns 'clone_voices' field
    const clonedVoices = data.clone_voices || []
    return { used: Array.isArray(clonedVoices) ? clonedVoices.length : 0 }
  } catch (error) {
    console.error('[QuotaServices] TopMediai API error:', error)
    return { used: 0, error: String(error) }
  }
}

/**
 * Get WaveSpeed balance via API
 * API: GET /api/v3/balance
 * Returns balance in USD, converts to minutes (÷ $3.38)
 */
export async function getWaveSpeedBalance(): Promise<{
  data: WaveSpeedBalance | null
  error?: string
}> {
  const config = useRuntimeConfig()
  const apiKey = config.wavespeedApiKey

  if (!apiKey) {
    return { data: null, error: 'WaveSpeed API key not configured' }
  }

  try {
    const response = await fetch(`${WAVESPEED_BASE_URL}/balance`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return { data: null, error: `API error: ${response.status}` }
    }

    const data = await response.json()
    console.log('[QuotaServices] WaveSpeed balance:', data)

    // WaveSpeed returns balance in USD
    const balance = data.balance ?? data.data?.balance ?? 0
    const COST_PER_MINUTE = 3.38

    return {
      data: {
        balance: Number(balance),
        minutes: Number(balance) / COST_PER_MINUTE,
      },
    }
  } catch (error) {
    console.error('[QuotaServices] WaveSpeed API error:', error)
    return { data: null, error: String(error) }
  }
}

/**
 * Get quota settings from database
 */
export async function getQuotaSettings(): Promise<Record<string, DbQuotaSetting>> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('quota_settings').select('*')

    if (error) {
      console.error('[QuotaServices] Failed to get quota settings:', error)
      return {}
    }

    const result: Record<string, DbQuotaSetting> = {}
    for (const row of data || []) {
      result[row.service_id] = row
    }
    return result
  } catch (error) {
    console.error('[QuotaServices] Failed to get quota settings:', error)
    return {}
  }
}

/**
 * Calculate quota status based on usage percentage
 */
function getQuotaStatus(used: number, total: number): QuotaStatus {
  if (total <= 0) return 'normal'
  const percentage = (used / total) * 100
  if (percentage >= 90) return 'critical'
  if (percentage >= 70) return 'warning'
  return 'normal'
}

/**
 * Get next month's first day as reset date
 */
function getNextMonthResetDate(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}

/**
 * Build complete service quotas data for dashboard
 * Uses real API data for TopMediai and WaveSpeed
 */
export async function buildServiceQuotas(): Promise<ServiceQuota[]> {
  // Fetch all data in parallel
  const [topMediaiKeyInfo, waveSpeedBalance, cloneResult, quotaSettings, usageData] = await Promise.all([
    getTopMediaiKeyInfo(),
    getWaveSpeedBalance(),
    getTopMediaiCloneCount(),
    getQuotaSettings(),
    getAllServicesUsage(),
  ])

  const services: ServiceQuota[] = []

  for (const config of SERVICE_CONFIGS) {
    const quotas: QuotaItem[] = []

    for (const quotaConfig of config.quotas) {
      const setting = quotaSettings[config.serviceId]
      let totalQuota = setting?.total_quota ?? quotaConfig.defaultTotal
      const billingType = setting?.billing_type ?? quotaConfig.billingType

      let used = 0
      let remaining: number | undefined
      let errorMessage: string | undefined

      // Get local usage data for this service
      const serviceUsage = usageData[config.serviceId]
      const localUsed = serviceUsage
        ? (billingType === 'monthly' ? serviceUsage.monthly : serviceUsage.allTime)
        : 0

      // Track inferred plan name for TopMediai Clone
      let inferredPlanName: string | undefined

      switch (config.serviceId) {
        case 'topmediai_clone':
          // TopMediai Clone: API returns remaining count
          if (topMediaiKeyInfo.data) {
            remaining = topMediaiKeyInfo.data.key_clone_voices
            used = cloneResult.used

            // Use database setting if available, otherwise infer from remaining
            const dbSetting = quotaSettings['topmediai_clone']
            if (dbSetting?.total_quota) {
              totalQuota = dbSetting.total_quota
              inferredPlanName = dbSetting.plan_name || 'Startup'
            } else {
              // Infer: find smallest plan >= remaining
              const remainingCount = remaining ?? 0
              const matchedPlan = TOPMEDIAI_CLONE_PLANS
                .filter(p => p.maxClones >= remainingCount)
                .sort((a, b) => a.maxClones - b.maxClones)[0]
              totalQuota = matchedPlan?.maxClones || 50
              inferredPlanName = matchedPlan?.name || 'Startup'
            }
            console.log(`[QuotaServices] TopMediai Clone: used=${used}, remaining=${remaining}, total=${totalQuota}, plan=${inferredPlanName}`)
          } else {
            errorMessage = topMediaiKeyInfo.error
            used = cloneResult.used
          }
          break

        case 'topmediai_tts':
          // TopMediai TTS: API returns remaining characters
          if (topMediaiKeyInfo.data) {
            remaining = topMediaiKeyInfo.data.key_words_counts
            used = localUsed
            totalQuota = used + remaining
          } else {
            errorMessage = topMediaiKeyInfo.error
            used = localUsed
          }
          break

        case 'wavespeed':
          // WaveSpeed: API returns balance in USD, convert to minutes
          if (waveSpeedBalance.data) {
            remaining = waveSpeedBalance.data.minutes
            used = localUsed
            totalQuota = used + remaining
          } else {
            errorMessage = waveSpeedBalance.error
            used = localUsed
          }
          break

        default:
          // Vidnoz, Gemini, Whisper: Use local tracking
          used = localUsed
          remaining = totalQuota - used
          break
      }

      // Calculate status based on usage
      let status: QuotaStatus
      if (errorMessage) {
        status = 'error'
      } else if (remaining !== undefined) {
        // For API-based services, calculate status from remaining
        if (config.serviceId === 'topmediai_clone') {
          status = remaining < 2 ? 'critical' : remaining < 5 ? 'warning' : 'normal'
        } else if (config.serviceId === 'topmediai_tts') {
          status = remaining < 2000 ? 'critical' : remaining < 10000 ? 'warning' : 'normal'
        } else if (config.serviceId === 'wavespeed') {
          status = remaining < 1 ? 'critical' : remaining < 3 ? 'warning' : 'normal'
        } else {
          status = getQuotaStatus(used, totalQuota)
        }
      } else {
        status = getQuotaStatus(used, totalQuota)
      }

      // Calculate billing cycle dates for monthly billing
      let billingCycleStart: string | undefined
      let billingCycleEnd: string | undefined
      if (billingType === 'monthly' && setting?.billing_cycle_start) {
        billingCycleStart = setting.billing_cycle_start
        const startDate = new Date(setting.billing_cycle_start)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + (setting.billing_cycle_days || 30))
        billingCycleEnd = endDate.toISOString().split('T')[0]
      }

      quotas.push({
        type: quotaConfig.type,
        label: quotaConfig.label,
        used,
        total: totalQuota,
        remaining,
        unit: quotaConfig.unit,
        source: quotaConfig.source,
        billingType,
        resetDate: billingType === 'monthly' ? getNextMonthResetDate() : undefined,
        billingCycleStart,
        billingCycleEnd,
        status,
        errorMessage,
        planName: inferredPlanName,
      })
    }

    services.push({
      serviceId: config.serviceId,
      serviceName: config.serviceName,
      description: config.description,
      quotas,
      upgradeUrl: config.upgradeUrl,
      lastUpdated: new Date().toISOString(),
    })
  }

  return services
}

/**
 * Calculate summary statistics from service quotas
 */
export function calculateSummary(services: ServiceQuota[]): {
  totalServices: number
  servicesWarning: number
  servicesCritical: number
} {
  let servicesWarning = 0
  let servicesCritical = 0

  for (const service of services) {
    for (const quota of service.quotas) {
      if (quota.status === 'critical') {
        servicesCritical++
        break
      } else if (quota.status === 'warning') {
        servicesWarning++
        break
      }
    }
  }

  return {
    totalServices: services.length,
    servicesWarning,
    servicesCritical,
  }
}
