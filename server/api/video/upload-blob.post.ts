import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * POST /api/video/upload-blob
 *
 * Upload video blob directly to Supabase Storage using admin client.
 * Used for uploading burned videos (with subtitles) from client.
 * This bypasses RLS policies for users authenticated via CMoney OIDC.
 */
export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)

    const fileField = formData?.find((f) => f.name === 'file')
    const userIdField = formData?.find((f) => f.name === 'userId')

    if (!fileField?.data) {
      throw createError({
        statusCode: 400,
        message: 'file is required',
      })
    }

    if (!userIdField?.data) {
      throw createError({
        statusCode: 400,
        message: 'userId is required',
      })
    }

    const userId = userIdField.data.toString()
    const videoBuffer = Buffer.from(fileField.data)

    console.log('Uploading burned video for user:', userId)
    console.log('Video size:', videoBuffer.length, 'bytes')

    // Generate unique filename with -burned suffix
    const filename = `${userId}/${Date.now()}-burned.mp4`

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filename, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase Storage upload error:', {
        message: uploadError.message,
        name: uploadError.name,
        cause: uploadError.cause,
      })
      throw createError({
        statusCode: 500,
        message: `Failed to upload video: ${uploadError.message}`,
      })
    }

    // Verify upload by checking if file exists
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from('videos')
      .download(filename)

    if (verifyError || !verifyData) {
      console.error('Upload verification failed:', {
        error: verifyError,
        filename,
        userId,
      })
      throw createError({
        statusCode: 500,
        message: 'Video upload verification failed - file may not have been saved.',
      })
    }

    console.log('Upload verified, file size:', verifyData.size, 'bytes')

    // Get public URL
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filename)

    console.log('Burned video uploaded successfully:', urlData.publicUrl)

    return {
      publicUrl: urlData.publicUrl,
    }
  } catch (error: any) {
    console.error('Blob upload API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload video blob',
    })
  }
})
