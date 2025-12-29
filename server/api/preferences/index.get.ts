import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { DbUserPreferences } from '~/types'

/**
 * GET /api/preferences
 *
 * Get user preferences.
 * Uses admin client to bypass RLS for CMoney OIDC users.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId is required',
    })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // PGRST116 means no rows found - return null, not an error
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Failed to fetch user preferences:', error)
      throw createError({
        statusCode: 500,
        message: `Failed to fetch user preferences: ${error.message}`,
      })
    }

    return data as DbUserPreferences
  } catch (error: any) {
    console.error('Error in GET /api/preferences:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})
