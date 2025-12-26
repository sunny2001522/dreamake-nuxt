/**
 * GET /api/admin/voices
 * Returns list of all cloned voices from TopMediai
 */

import { validateAdminAccess } from '~/server/utils/admin/auth'
import type { ClonedVoice } from '~/types/admin'

const TOPMEDIAI_BASE_URL = 'https://api.topmediai.com/v1'

export default defineEventHandler(async (event): Promise<{ voices: ClonedVoice[] }> => {
  const userEmail = getHeader(event, 'x-user-email')
  const { authorized, error } = validateAdminAccess(userEmail)

  if (!authorized) {
    throw createError({
      statusCode: error!.statusCode,
      message: error!.message,
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
    const response = await fetch(`${TOPMEDIAI_BASE_URL}/clone_voices_list`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: `TopMediai API error: ${response.status}`,
      })
    }

    const data = await response.json()
    const clonedVoices = data.clone_voices || []

    const voices: ClonedVoice[] = clonedVoices.map((voice: any) => ({
      speaker_id: voice.speaker || voice.speaker_id || '',
      speaker_name: voice.name || voice.speaker_name || '未命名',
      model: voice.model || undefined,
      created_at: voice.created_at || undefined,
    }))

    return { voices }
  } catch (err: any) {
    console.error('[Admin Voices API] Error:', err)
    if (err.statusCode) {
      throw err
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch voices',
    })
  }
})
