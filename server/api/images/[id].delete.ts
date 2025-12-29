import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * DELETE /api/images/:id
 *
 * Delete an image by ID, including its storage files (original and thumbnail).
 * Uses admin client to bypass RLS for CMoney OIDC users.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Get image to find storage path
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw createError({
          statusCode: 404,
          message: 'Image not found',
        })
      }
      throw createError({
        statusCode: 500,
        message: `Failed to fetch image: ${fetchError.message}`,
      })
    }

    // Delete from Storage
    if (image) {
      try {
        // Delete original image
        if (image.image_url) {
          const url = new URL(image.image_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(-2).join('/')
          await supabase.storage.from('avatars').remove([filePath])
        }

        // Delete thumbnail if exists
        if (image.thumbnail_url) {
          const thumbUrl = new URL(image.thumbnail_url)
          const thumbPathParts = thumbUrl.pathname.split('/')
          const thumbPath = thumbPathParts.slice(-2).join('/')
          await supabase.storage.from('avatars').remove([thumbPath])
        }
      } catch {
        // URL parsing failed, continue with database deletion
        console.warn('Failed to parse image URLs for deletion')
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('images')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        message: `Failed to delete image: ${deleteError.message}`,
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in DELETE /api/images/:id:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})
