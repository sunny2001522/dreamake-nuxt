// Admin Dashboard Types for API Usage Tracking

export type QuotaSource = 'api' | 'local' | 'manual'
export type BillingType = 'monthly' | 'cumulative'
export type QuotaStatus = 'normal' | 'warning' | 'critical' | 'loading' | 'error'

export interface QuotaItem {
  type: string           // 'clones', 'characters', 'requests', 'minutes'
  label: string          // 顯示名稱
  used: number
  total: number
  remaining?: number     // 剩餘量（API 查詢或計算得出）
  unit: string           // '個', '字元', '次', '分鐘'
  source: QuotaSource
  billingType: BillingType
  resetDate?: string     // ISO date string for next reset (monthly billing)
  billingCycleStart?: string  // ISO date string - 計費週期起始日
  billingCycleEnd?: string    // ISO date string - 計費週期結束日（起始日 + 30 天）
  status: QuotaStatus
  errorMessage?: string
  planName?: string      // 推斷的方案名稱（如 'Scale', 'Pro'）
}

export interface ServiceQuota {
  serviceId: string
  serviceName: string
  description: string
  quotas: QuotaItem[]
  upgradeUrl: string
  lastUpdated: string    // ISO date string
}

export interface UsageDashboardData {
  services: ServiceQuota[]
  summary: {
    totalServices: number
    servicesWarning: number   // 70-90% usage
    servicesCritical: number  // 90%+ usage
  }
  timestamp: string
}

// Database table types
export interface DbApiUsage {
  id: string
  service_id: string
  operation: string
  quantity: number
  user_id: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export interface DbQuotaSetting {
  service_id: string
  quota_type: string
  total_quota: number
  billing_type: BillingType
  plan_name: string | null
  billing_cycle_start: string | null  // ISO date string
  billing_cycle_days: number | null
  updated_at: string
}

// API quota query result types
export interface TopMediaiKeyInfo {
  key_words_counts: number   // TTS 剩餘字元數
  key_clone_voices: number   // 聲音克隆剩餘次數
}

// TopMediai Clone 方案對照表
// 來源: https://www.topmediai.com/api/voice-cloning-api/purchase/
export const TOPMEDIAI_CLONE_PLANS = [
  { name: 'Startup', maxClones: 50 },
  { name: 'Growth', maxClones: 150 },
  { name: 'Scale', maxClones: 800 },
  { name: 'Business', maxClones: 2000 },
] as const

export interface WaveSpeedBalance {
  balance: number            // USD 餘額
  minutes: number            // 換算成分鐘數 (balance / 3.38)
}

// Cloned voice from TopMediai
export interface ClonedVoice {
  speaker_id: string
  speaker_name: string
  model?: string
  created_at?: string
}

// Service configuration
export interface ServiceConfig {
  serviceId: string
  serviceName: string
  description: string
  upgradeUrl: string
  quotas: {
    type: string
    label: string
    unit: string
    source: QuotaSource
    billingType: BillingType
    defaultTotal: number
  }[]
}

// Predefined service configurations
export const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    serviceId: 'topmediai_clone',
    serviceName: 'TopMediai 聲音克隆',
    description: '語音克隆數量（API 即時查詢）',
    upgradeUrl: 'https://www.topmediai.com/api/voice-cloning-api/',
    quotas: [{
      type: 'clones',
      label: '剩餘克隆次數',
      unit: '個',
      source: 'api',
      billingType: 'cumulative',
      defaultTotal: 50,
    }],
  },
  {
    serviceId: 'topmediai_tts',
    serviceName: 'TopMediai TTS',
    description: '文字轉語音字元數（API 即時查詢）',
    upgradeUrl: 'https://www.topmediai.com/api/',
    quotas: [{
      type: 'characters',
      label: '剩餘字元',
      unit: '字元',
      source: 'api',
      billingType: 'monthly',
      defaultTotal: 100000,
    }],
  },
  {
    serviceId: 'vidnoz',
    serviceName: 'Vidnoz',
    description: '談話頭影片生成（手動配額設定）',
    upgradeUrl: 'https://www.vidnoz.com/pricing.html',
    quotas: [{
      type: 'minutes',
      label: '影片生成',
      unit: '分鐘',
      source: 'manual',
      billingType: 'monthly',
      defaultTotal: 166,
    }],
  },
  {
    serviceId: 'wavespeed',
    serviceName: 'WaveSpeed',
    description: '高品質影片生成（API 即時查詢）',
    upgradeUrl: 'https://wavespeed.ai/pricing',
    quotas: [{
      type: 'minutes',
      label: '剩餘分鐘',
      unit: '分鐘',
      source: 'api',
      billingType: 'cumulative',
      defaultTotal: 10.6,
    }],
  },
  {
    serviceId: 'gemini',
    serviceName: 'Google Gemini',
    description: '文本生成請求（手動配額設定）',
    upgradeUrl: 'https://ai.google.dev/pricing',
    quotas: [{
      type: 'requests',
      label: '請求數',
      unit: '次',
      source: 'manual',
      billingType: 'monthly',
      defaultTotal: 1000,
    }],
  },
  {
    serviceId: 'whisper',
    serviceName: 'OpenAI Whisper',
    description: '語音轉文字（本地追蹤）',
    upgradeUrl: 'https://platform.openai.com/usage',
    quotas: [{
      type: 'minutes',
      label: '音頻分鐘',
      unit: '分鐘',
      source: 'local',
      billingType: 'cumulative',
      defaultTotal: 60,
    }],
  },
]
