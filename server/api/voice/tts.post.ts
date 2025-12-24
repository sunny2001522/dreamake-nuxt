import { textToSpeech } from '~/server/utils/topmediai'

/**
 * POST /api/voice/tts
 *
 * Generate speech using an existing cloned voice (speakerId).
 * This skips the voice cloning step and directly calls TTS.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { speakerId, transcript } = body

    if (!speakerId) {
      throw createError({
        statusCode: 400,
        message: 'speakerId is required',
      })
    }

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'transcript is required',
      })
    }

    const { audioUrl } = await textToSpeech(transcript, speakerId)

    return {
      success: true,
      speakerId,
      audioUrl,
      transcript: transcript.substring(0, 500),
    }
  } catch (error: any) {
    console.error('TTS API Error:', error)

    // Map specific errors to HTTP responses
    if (error.message?.includes('Speaker not found')) {
      throw createError({
        statusCode: 404,
        message: error.message,
      })
    }

    if (error.message?.includes('API key not configured') || error.message?.includes('required')) {
      throw createError({
        statusCode: 400,
        message: error.message,
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      data: { details: String(error) },
    })
  }
})
