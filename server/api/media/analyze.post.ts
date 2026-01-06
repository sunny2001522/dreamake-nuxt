import { parseMediaUrl } from '~/server/utils/media/urlParser'

const DEFAULT_CHANNEL_LIMIT = 10  // 頻道分析預設 10 支影片（避免 rate limit）
const MAX_URLS = 10  // 單次請求最多 10 個 URL
const API_TIMEOUT_MS = 30000  // 30 秒超時

interface AnalyzeRequest {
  items: Array<{ url: string; limit?: number }>
}

/**
 * POST /api/media/analyze
 *
 * 多平台媒體分析 API
 * 支援 YouTube, Twitch, Bilibili, TikTok, Podcast 等平台
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const mediaApiUrl = config.youtubeAnalysisApiUrl || 'https://development-agentgenerator.cmoney.tw'

  console.log('[Media Analyze] Starting analysis, API URL:', mediaApiUrl)

  try {
    const body: AnalyzeRequest = await readBody(event)
    const { items } = body

    console.log('[Media Analyze] Received items:', JSON.stringify(items, null, 2))

    // 驗證請求
    if (!items || items.length === 0) {
      throw createError({
        statusCode: 400,
        message: '請至少提供一個媒體連結',
      })
    }

    if (items.length > MAX_URLS) {
      throw createError({
        statusCode: 400,
        message: `一次最多支援 ${MAX_URLS} 個連結`,
      })
    }

    // 解析和驗證每個 URL
    const validatedItems = items.map(item => {
      const parsed = parseMediaUrl(item.url)
      console.log('[Media Analyze] Parsed URL:', item.url, '→', parsed)

      // 頻道類型自動設定 limit = 30
      if (parsed.type === 'channel' && !item.limit) {
        item.limit = DEFAULT_CHANNEL_LIMIT
      }

      return { ...item, parsed }
    })

    const validItems = validatedItems.filter(item => item.parsed.isValid)
    const invalidItems = validatedItems.filter(item => !item.parsed.isValid)

    console.log('[Media Analyze] Valid items:', validItems.length, 'Invalid items:', invalidItems.length)

    if (validItems.length === 0) {
      throw createError({
        statusCode: 400,
        message: '沒有有效的媒體連結',
        data: {
          details: invalidItems.map(item => ({
            url: item.url,
            error: item.parsed.error
          }))
        },
      })
    }

    // 使用 AbortController 設定超時
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      console.log('[Media Analyze] Calling backend API:', `${mediaApiUrl}/api/media/generate`)

      // 呼叫後端 API
      const response = await fetch(`${mediaApiUrl}/api/media/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validItems.map(item => ({
            url: item.url,
            limit: item.limit
          }))
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('[Media Analyze] Backend response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Media Analyze] Backend error:', response.status, errorText)
        throw createError({
          statusCode: response.status,
          message: `分析服務回應錯誤 (${response.status}): ${errorText.slice(0, 200)}`,
        })
      }

      const result = await response.json()
      console.log('[Media Analyze] Backend result:', JSON.stringify(result, null, 2))

      // 統計平台分布
      const platformCount = validItems.reduce((acc, item) => {
        const platform = item.parsed.platform
        acc[platform] = (acc[platform] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        success: true,
        job_id: result.job_id,
        message: result.message || '任務已建立',
        items_summary: {
          total: items.length,
          valid: validItems.length,
          invalid: invalidItems.length,
          by_platform: platformCount
        },
        warnings: invalidItems.length > 0 ?
          invalidItems.map(item => ({
            url: item.url,
            error: item.parsed.error
          })) : undefined
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        console.error('[Media Analyze] Request timeout after', API_TIMEOUT_MS, 'ms')
        throw createError({
          statusCode: 504,
          message: '分析服務連接逾時，請稍後再試',
        })
      }

      // 網絡錯誤
      if (fetchError.cause?.code === 'ECONNREFUSED' || fetchError.cause?.code === 'ENOTFOUND') {
        console.error('[Media Analyze] Network error:', fetchError.cause?.code)
        throw createError({
          statusCode: 503,
          message: '無法連接分析服務，請稍後再試',
        })
      }

      throw fetchError
    }
  } catch (error: any) {
    console.error('[Media Analyze] Error:', error.message || error)

    // 如果已經是 H3Error，直接拋出
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error.message || '伺服器錯誤',
      data: { details: String(error) },
    })
  }
})
