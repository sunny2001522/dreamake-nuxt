import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { DbPendingAnalysis, PendingAnalysis, MediaPlatform } from '~/types'

/**
 * GET /api/media/pending-list
 *
 * 獲取用戶所有 pending/processing 狀態的分析任務
 */
export default defineEventHandler(async (event) => {
  const supabase = getSupabaseAdmin()

  try {
    const query = getQuery(event)
    const userId = query.user_id as string

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'user_id is required',
      })
    }

    // 查詢所有 pending 和 processing 狀態的分析
    const { data, error } = await supabase
      .from('pending_analyses')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[PendingList] Query error:', error)
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch pending analyses',
      })
    }

    // 轉換為前端格式
    const analyses: PendingAnalysis[] = (data || []).map((item: DbPendingAnalysis) => ({
      id: item.id,
      jobId: item.job_id,
      sourceUrls: item.source_urls,
      platforms: item.platforms as MediaPlatform[],
      status: item.status,
      result: item.result || undefined,
      personaId: item.persona_id || undefined,
      errorMessage: item.error_message || undefined,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      lastPolledAt: item.last_polled_at ? new Date(item.last_polled_at) : undefined,
      pollCount: item.poll_count,
    }))

    return analyses
  }
  catch (error: any) {
    console.error('[PendingList] Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Server error',
    })
  }
})
