import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { DbUserPreferences } from '~/types'

/**
 * POST /api/preferences
 *
 * Upsert user preferences (insert or update).
 * Uses admin client to bypass RLS for CMoney OIDC users.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.user_id) {
    throw createError({
      statusCode: 400,
      message: 'user_id is required',
    })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(body, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      // Ignore foreign key constraint errors (local-only items)
      if (error.message?.includes('foreign key constraint') || error.code === '23503') {
        console.warn('Foreign key constraint error, item may not exist in Supabase:', error.message)
        return { success: true, warning: 'Item not found in database' }
      }
      console.error('Failed to upsert user preferences:', error)
      throw createError({
        statusCode: 500,
        message: `Failed to upsert user preferences: ${error.message}`,
      })
    }

    return data as DbUserPreferences
  } catch (error: any) {
    console.error('Error in POST /api/preferences:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})
