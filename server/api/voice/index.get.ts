import { getClonedVoices } from '~/server/utils/topmediai'

/**
 * GET /api/voice
 *
 * Returns the list of cloned voices for this API key.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.topMediaiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'TopMediai API key not configured',
    })
  }

  try {
    const query = getQuery(event)
    const name = query.name as string | undefined

    const result = await getClonedVoices(name)
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
