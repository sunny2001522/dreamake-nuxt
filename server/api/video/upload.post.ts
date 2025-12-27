import { getSupabaseAdmin } from '~/server/utils/supabase-admin'

/**
 * POST /api/video/upload
 *
 * Upload video from external URL to Supabase Storage using admin client.
 * This bypasses RLS policies for users authenticated via CMoney OIDC.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { externalUrl, userId } = body

    if (!externalUrl) {
      throw createError({
        statusCode: 400,
        message: 'externalUrl is required',
      })
    }

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'userId is required',
      })
    }

    console.log('Uploading video to storage for user:', userId)
    console.log('External URL:', externalUrl)

    // Download video from external URL
    const response = await fetch(externalUrl)
    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: `Failed to fetch video from external URL: ${response.statusText}`,
      })
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    console.log('Downloaded video size:', videoBuffer.length, 'bytes')

    // Generate unique filename
    const filename = `${userId}/${Date.now()}.mp4`

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
        message: 'Video upload verification failed - file may not have been saved. Please check Supabase Storage policies.',
      })
    }

    console.log('Upload verified, file size:', verifyData.size, 'bytes')

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filename)

    console.log('Video uploaded and verified successfully:', urlData.publicUrl)

    return {
      publicUrl: urlData.publicUrl,
    }
  } catch (error: any) {
    console.error('Video upload API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload video',
    })
  }
})
