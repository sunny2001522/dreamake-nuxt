import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { STORAGE_BUCKET } from '~/server/utils/supabase'

/**
 * POST /api/images
 *
 * Upload image to Supabase Storage and save metadata to database
 * Uses admin client to bypass RLS
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

    const fileField = formData.find(field => field.name === 'file')
    const userIdField = formData.find(field => field.name === 'userId')
    const nameField = formData.find(field => field.name === 'name')

    if (!fileField?.data || !userIdField?.data) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields (file, userId)',
      })
    }

    const userId = userIdField.data.toString()
    const name = nameField?.data?.toString() || 'image'
    const timestamp = Date.now()
    const ext = (fileField.filename || 'file').split('.').pop() || 'jpg'

    const supabase = getSupabaseAdmin()

    // 1. Upload image to Storage
    const filePath = `${userId}/${timestamp}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileField.data, {
        contentType: fileField.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw createError({
        statusCode: 500,
        message: `Failed to upload image: ${uploadError.message}`,
      })
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    // 3. Save metadata to database
    const { data, error } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        name: name,
        image_url: urlData.publicUrl,
        image_mime_type: fileField.type || 'image/jpeg',
        thumbnail_url: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Database insert error:', error)
      throw createError({
        statusCode: 500,
        message: `Failed to save image metadata: ${error.message}`,
      })
    }

    console.log('Image uploaded successfully:', data.id)
    return data
  } catch (error: any) {
    console.error('Image upload API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Upload failed',
    })
  }
})
