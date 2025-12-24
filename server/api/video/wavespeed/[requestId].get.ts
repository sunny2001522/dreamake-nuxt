import { getWaveSpeedVideoStatus } from '~/server/utils/wavespeed'

/**
 * GET /api/video/wavespeed/[requestId]
 * Poll WaveSpeed video generation status.
 *
 * Response:
 * - success: boolean
 * - status: 'pending' | 'processing' | 'completed' | 'failed'
 * - videoUrl?: string (only when completed)
 * - executionTime?: number (in seconds)
 * - error?: string (only when failed)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.wavespeedApiKey) {
    console.error('WAVESPEED_API_KEY not configured')
    throw createError({
      statusCode: 500,
      message: 'WaveSpeed service not configured',
    })
  }

  try {
    const requestId = getRouterParam(event, 'requestId')

    if (!requestId) {
      throw createError({
        statusCode: 400,
        message: 'requestId is required',
      })
    }

    const result = await getWaveSpeedVideoStatus(requestId)

    return {
      success: true,
      status: result.status,
      videoUrl: result.videoUrl,
      executionTime: result.executionTime,
      error: result.error,
    }
  } catch (error: any) {
    console.error('WaveSpeed status API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch WaveSpeed video status',
      data: { details: error.message },
    })
  }
})
