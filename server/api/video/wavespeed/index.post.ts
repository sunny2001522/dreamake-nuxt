import { generateWaveSpeedVideo, DEFAULT_WAVESPEED_PROMPT } from '~/server/utils/wavespeed'
import type { WaveSpeedResolution } from '~/types'

/**
 * POST /api/video/wavespeed
 * Start video generation using WaveSpeed InfiniteTalk API.
 *
 * Request body:
 * - audioUrl: string - URL of the audio file
 * - imageUrl: string - URL of the avatar image
 * - prompt?: string - Motion description prompt (optional)
 * - resolution?: '480p' | '720p' | '1080p' - Video resolution (default: 720p)
 *
 * Response:
 * - success: boolean
 * - requestId: string - WaveSpeed request ID for polling
 * - status: 'pending'
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
    const body = await readBody(event)
    const {
      audioUrl,
      imageUrl,
      prompt = DEFAULT_WAVESPEED_PROMPT,
      resolution = '720p' as WaveSpeedResolution,
    } = body

    // Validation
    if (!audioUrl) {
      throw createError({
        statusCode: 400,
        message: 'audioUrl is required',
      })
    }

    if (!imageUrl) {
      throw createError({
        statusCode: 400,
        message: 'imageUrl is required',
      })
    }

    console.log('Starting WaveSpeed video generation:', {
      audioUrl,
      imageUrl,
      prompt,
      resolution,
    })

    // Call WaveSpeed API
    const { requestId } = await generateWaveSpeedVideo({
      audioUrl,
      imageUrl,
      prompt,
      resolution,
    })

    console.log('WaveSpeed video generation started, requestId:', requestId)

    return {
      success: true,
      requestId,
      status: 'pending',
    }
  } catch (error: any) {
    console.error('WaveSpeed video generation API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to start WaveSpeed video generation',
      data: { details: error.message },
    })
  }
})
