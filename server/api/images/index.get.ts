import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { DbImage } from '~/types'

/**
 * GET /api/images
 *
 * Get all images for a user, sorted by last_used_at (most recent first).
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
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch images:', error)
      throw createError({
        statusCode: 500,
        message: `Failed to fetch images: ${error.message}`,
      })
    }

    return data as DbImage[]
  } catch (error: any) {
    console.error('Error in GET /api/images:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})
