import { STORAGE_BUCKET } from '~/server/utils/supabase'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * POST /api/upload
 *
 * Upload file to Supabase Storage
 */
export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: 'No form data received',
      })
    }

    // Find the file field
    const fileField = formData.find(field => field.name === 'file')

    if (!fileField || !fileField.data) {
      throw createError({
        statusCode: 400,
        message: 'No file provided',
      })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = (fileField.filename || 'file').split('.').pop() || 'jpg'
    const fileName = `${timestamp}-${randomId}.${extension}`

    // Get admin client
    const supabase = getSupabaseAdmin()

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileField.data, {
        contentType: fileField.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      console.error('Supabase upload error:', error)
      throw createError({
        statusCode: 500,
        message: 'Upload failed',
        data: { details: error.message },
      })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName)

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (error: any) {
    console.error('Upload API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Upload failed',
    })
  }
})
