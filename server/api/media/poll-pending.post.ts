import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { consumeTokens } from '~/server/utils/subscription/tokenService'
import type { DbPendingAnalysis, PendingAnalysis, MediaPlatform, PollPendingResponse } from '~/types'

const ANALYSIS_TOKEN_COST = 1

/**
 * 從 URL 提取顯示名稱
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      // /@username 格式
      const match = urlObj.pathname.match(/@([^/]+)/)
      if (match) return match[1]

      // /channel/xxx 格式
      const channelMatch = urlObj.pathname.match(/\/channel\/([^/]+)/)
      if (channelMatch) return `Channel ${channelMatch[1].slice(0, 8)}`

      return 'YouTube 頻道'
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      const match = urlObj.pathname.match(/\/([^/]+)/)
      if (match && !['videos', 'clips'].includes(match[1])) {
        return match[1]
      }
      return 'Twitch 頻道'
    }

    // Bilibili
    if (hostname.includes('bilibili.com')) {
      return 'Bilibili 頻道'
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      const match = urlObj.pathname.match(/@([^/]+)/)
      if (match) return match[1]
      return 'TikTok 帳號'
    }

    return '媒體分析'
  }
  catch {
    return '媒體分析'
  }
}

/**
 * 查詢外部分析服務狀態
 */
async function checkExternalStatus(jobId: string, mediaApiUrl: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: string
  error?: string
}> {
  try {
    const response = await fetch(`${mediaApiUrl}/api/media/result?job_id=${jobId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    // 404 = 任務尚未完成
    if (response.status === 404) {
      return { status: 'pending' }
    }

    if (!response.ok) {
      return { status: 'processing' }
    }

    const contentType = response.headers.get('content-type')

    // JSON 響應
    if (contentType?.includes('application/json')) {
      const result = await response.json()

      if (result.error === 'not_found') {
        return { status: 'processing' }
      }

      if (result.result) {
        return { status: 'completed', result: result.result }
      }

      if (result.status === 'failed' || result.status === 'error') {
        return { status: 'failed', error: result.message || 'Analysis failed' }
      }

      return { status: result.status || 'processing' }
    }

    // Markdown/純文字響應（已完成）
    const textResult = await response.text()
    if (textResult && textResult.length > 0) {
      return { status: 'completed', result: textResult }
    }

    return { status: 'processing' }
  }
  catch (error: any) {
    console.error(`[PollPending] External check failed for ${jobId}:`, error)
    return { status: 'processing' }
  }
}

/**
 * POST /api/media/poll-pending
 *
 * 輪詢所有 pending 分析任務並處理完成的任務
 */
export default defineEventHandler(async (event) => {
  const supabase = getSupabaseAdmin()
  const config = useRuntimeConfig()
  const mediaApiUrl = config.youtubeAnalysisApiUrl || 'https://development-agentgenerator.cmoney.tw'

  try {
    // 從 request body 獲取 userId（由前端傳遞）
    const body = await readBody(event)
    const userId = body?.user_id

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'user_id is required',
      })
    }

    // 獲取該用戶所有 pending/processing 分析
    const { data: pendingList, error: queryError } = await supabase
      .from('pending_analyses')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])

    if (queryError) {
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch pending analyses',
      })
    }

    if (!pendingList || pendingList.length === 0) {
      return {
        analyses: [],
        completed: [],
        failed: [],
      } as PollPendingResponse
    }

    const completed: PollPendingResponse['completed'] = []
    const failed: PollPendingResponse['failed'] = []
    const analyses: PendingAnalysis[] = []

    // 逐一檢查每個 pending 分析
    for (const pending of pendingList as DbPendingAnalysis[]) {
      const now = new Date().toISOString()

      // 查詢外部服務狀態
      const externalStatus = await checkExternalStatus(pending.job_id, mediaApiUrl)

      if (externalStatus.status === 'completed' && externalStatus.result) {
        // === 分析完成 ===

        // 1. 扣除 Token
        const tokenResult = await consumeTokens({
          userId,
          operationType: 'media_analysis',
          operationId: pending.job_id,
          description: '頻道風格分析',
          customCost: ANALYSIS_TOKEN_COST,
        })

        if (!tokenResult.success) {
          console.error(`[PollPending] Token consumption failed for ${pending.job_id}:`, tokenResult.error)
          // Token 不足也視為完成，但記錄錯誤
        }

        // 2. 自動儲存為 Persona
        const { data: personaData, error: personaError } = await supabase
          .from('personas')
          .insert({
            user_id: userId,
            name: extractNameFromUrl(pending.source_urls[0]),
            content: externalStatus.result,
            source: 'media',
            source_urls: pending.source_urls,
            platforms: pending.platforms,
            job_id: pending.job_id,
          })
          .select('id')
          .single()

        if (personaError) {
          console.error(`[PollPending] Failed to save persona for ${pending.job_id}:`, personaError)
        }

        const personaId = personaData?.id || null

        // 3. 更新 pending_analyses 為 completed
        await supabase
          .from('pending_analyses')
          .update({
            status: 'completed',
            result: externalStatus.result,
            persona_id: personaId,
            updated_at: now,
            last_polled_at: now,
            poll_count: pending.poll_count + 1,
          })
          .eq('id', pending.id)

        completed.push({
          id: pending.id,
          jobId: pending.job_id,
          result: externalStatus.result,
          personaId: personaId || '',
        })
      }
      else if (externalStatus.status === 'failed') {
        // === 分析失敗 ===
        await supabase
          .from('pending_analyses')
          .update({
            status: 'failed',
            error_message: externalStatus.error || 'Analysis failed',
            updated_at: now,
            last_polled_at: now,
            poll_count: pending.poll_count + 1,
          })
          .eq('id', pending.id)

        failed.push({
          id: pending.id,
          jobId: pending.job_id,
          errorMessage: externalStatus.error || 'Analysis failed',
        })
      }
      else {
        // === 仍在處理中 ===
        await supabase
          .from('pending_analyses')
          .update({
            status: externalStatus.status,
            updated_at: now,
            last_polled_at: now,
            poll_count: pending.poll_count + 1,
          })
          .eq('id', pending.id)

        analyses.push({
          id: pending.id,
          jobId: pending.job_id,
          sourceUrls: pending.source_urls,
          platforms: pending.platforms as MediaPlatform[],
          status: externalStatus.status,
          createdAt: new Date(pending.created_at),
          updatedAt: new Date(now),
          lastPolledAt: new Date(now),
          pollCount: pending.poll_count + 1,
        })
      }
    }

    return {
      analyses,
      completed,
      failed,
    } as PollPendingResponse
  }
  catch (error: any) {
    console.error('[PollPending] Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Server error',
    })
  }
})
