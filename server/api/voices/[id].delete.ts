import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * DELETE /api/voices/:id
 *
 * Delete a voice by ID, including its storage file.
 * Uses admin client to bypass RLS for CMoney OIDC users.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Voice ID is required',
    })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Get voice to find storage path
    const { data: voice, error: fetchError } = await supabase
      .from('voices')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw createError({
          statusCode: 404,
          message: 'Voice not found',
        })
      }
      throw createError({
        statusCode: 500,
        message: `Failed to fetch voice: ${fetchError.message}`,
      })
    }

    // Delete from Storage if audio_url exists
    if (voice?.audio_url) {
      try {
        const url = new URL(voice.audio_url)
        const pathParts = url.pathname.split('/')
        const filePath = pathParts.slice(-2).join('/')

        await supabase.storage.from('voices').remove([filePath])
      } catch {
        // URL parsing failed, continue with database deletion
        console.warn('Failed to parse audio URL for deletion:', voice.audio_url)
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('voices')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        message: `Failed to delete voice: ${deleteError.message}`,
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in DELETE /api/voices/:id:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})
