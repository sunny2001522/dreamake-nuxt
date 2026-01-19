import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * POST /api/media/cancel
 *
 * 取消分析任務
 */
export default defineEventHandler(async (event) => {
  const supabase = getSupabaseAdmin()

  try {
    const body = await readBody(event)
    const { job_id, user_id } = body

    if (!job_id || !user_id) {
      throw createError({
        statusCode: 400,
        message: 'job_id and user_id are required',
      })
    }

    // 更新 pending_analyses 狀態為 cancelled
    const { error: updateError } = await supabase
      .from('pending_analyses')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', job_id)
      .eq('user_id', user_id)

    if (updateError) {
      console.error('[Media Cancel] Failed to cancel:', updateError)
      throw createError({
        statusCode: 500,
        message: 'Failed to cancel analysis',
      })
    }

    console.log('[Media Cancel] Cancelled job:', job_id)

    return {
      success: true,
      job_id,
      message: '分析已取消',
    }
  }
  catch (error: any) {
    console.error('[Media Cancel] Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Server error',
    })
  }
})
