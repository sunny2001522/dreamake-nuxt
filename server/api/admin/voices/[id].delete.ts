/**
 * DELETE /api/admin/voices/:id
 * Delete a cloned voice from TopMediai
 */

import { validateAdminAccess } from '~/server/utils/admin/auth'

const TOPMEDIAI_BASE_URL = 'https://api.topmediai.com/v1'

export default defineEventHandler(async (event): Promise<{ success: boolean; message: string }> => {
  const userEmail = getHeader(event, 'x-user-email')
  const { authorized, error } = validateAdminAccess(userEmail)

  if (!authorized) {
    throw createError({
      statusCode: error!.statusCode,
      message: error!.message,
    })
  }

  const speakerId = getRouterParam(event, 'id')

  if (!speakerId) {
    throw createError({
      statusCode: 400,
      message: 'Speaker ID is required',
    })
  }

  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'TopMediai API key not configured',
    })
  }

  try {
    const response = await fetch(`${TOPMEDIAI_BASE_URL}/clone_voice_del/${speakerId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Check if it's a "ghost voice" (already deleted but still in list)
      if (errorData.message?.includes('speaker not exist')) {
        return {
          success: true,
          message: 'Voice was already deleted (ghost voice)',
        }
      }

      throw createError({
        statusCode: response.status,
        message: `TopMediai API error: ${errorData.message || response.status}`,
      })
    }

    console.log(`[Admin Voices API] Deleted voice: ${speakerId}`)

    return {
      success: true,
      message: 'Voice deleted successfully',
    }
  } catch (err: any) {
    console.error('[Admin Voices API] Delete error:', err)
    if (err.statusCode) {
      throw err
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to delete voice',
    })
  }
})
