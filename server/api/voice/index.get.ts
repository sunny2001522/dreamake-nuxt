import { listVoices } from '~/server/utils/inworld'

/**
 * GET /api/voice
 *
 * Returns the list of cloned voices for this API key.
 * Note: For Inworld, cloned voices are stored in our database, not retrieved from API
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.inworldApiKey) {
    throw createError({
      statusCode: 500,
      message: 'Inworld API key not configured',
    })
  }

  try {
    // Note: Inworld doesn't provide a list voices API like TopMediai
    // Voice list is managed in our Supabase database
    const result = await listVoices()
    return result
  } catch (error: any) {
    console.error('Get voices error:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal server error',
      data: { details: String(error) },
    })
  }
})
