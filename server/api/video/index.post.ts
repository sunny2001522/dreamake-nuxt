import { generateTalkingVideo } from '~/server/utils/vidnoz'

/**
 * POST /api/video
 * Start video generation using Vidnoz Talking Avatar API.
 *
 * Request body:
 * - avatarUrl: string - URL of the avatar image
 * - audioUrl: string - URL of the audio file
 *
 * Response:
 * - success: boolean
 * - requestId: string - Vidnoz task ID for polling
 * - status: 'pending'
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
    const body = await readBody(event)
    const { avatarUrl, audioUrl } = body

    // Validation
    if (!avatarUrl) {
      throw createError({
        statusCode: 400,
        message: 'avatarUrl is required',
      })
    }

    if (!audioUrl) {
      throw createError({
        statusCode: 400,
        message: 'audioUrl is required',
      })
    }

    console.log('Starting Vidnoz video generation:', { avatarUrl, audioUrl })

    // Call Vidnoz API
    const { taskId } = await generateTalkingVideo(avatarUrl, audioUrl)

    console.log('Vidnoz video generation started, taskId:', taskId)

    return {
      success: true,
      requestId: taskId,
      status: 'pending',
    }
  } catch (error: any) {
    console.error('Video generation API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to start video generation',
      data: { details: error.message },
    })
  }
})
