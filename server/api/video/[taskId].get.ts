import { getTalkingVideoStatus } from '~/server/utils/vidnoz'

/**
 * GET /api/video/[taskId]
 * Get video generation status from Vidnoz API.
 *
 * Response:
 * - success: boolean
 * - status: 'pending' | 'generating' | 'completed' | 'failed'
 * - videoUrl: string | null
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.vidnozApiKey) {
    console.error('VIDNOZ_API_KEY not configured')
    throw createError({
      statusCode: 500,
      message: 'Video generation service not configured',
    })
  }

  try {
    const taskId = getRouterParam(event, 'taskId')

    if (!taskId) {
      throw createError({
        statusCode: 400,
        message: 'taskId is required',
      })
    }

    console.log('Checking Vidnoz video status for taskId:', taskId)

    // Call Vidnoz API
    const { status, videoUrl } = await getTalkingVideoStatus(taskId)

    // Map Vidnoz 'success' status to 'completed' for consistency
    const normalizedStatus = status === 'success' ? 'completed' : status

    console.log('Vidnoz video status:', { taskId, status: normalizedStatus, videoUrl })

    return {
      success: true,
      status: normalizedStatus,
      videoUrl: videoUrl || null,
    }
  } catch (error: any) {
    console.error('Video status API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to get video status',
      data: { details: error.message },
    })
  }
})
