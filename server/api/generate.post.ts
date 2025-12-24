import { textToSpeech } from '~/server/utils/topmediai'
import { generateTalkingVideoWithBuffer } from '~/server/utils/vidnoz'
import { generateWaveSpeedVideo, DEFAULT_WAVESPEED_PROMPT } from '~/server/utils/wavespeed'
import { cropImageToAspectRatio } from '~/server/utils/image/serverImageProcessor'
import { STORAGE_BUCKET } from '~/server/utils/supabase'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import type { VideoModel, WaveSpeedResolution } from '~/types'

/**
 * Upload cropped image buffer to Supabase Storage for WaveSpeed (requires URL)
 */
async function uploadTempImage(buffer: Buffer, filename: string): Promise<string> {
  // Use admin client to bypass RLS for temp folder uploads
  const supabase = getSupabaseAdmin()

  // Upload to temp folder
  const filePath = `temp/${filename}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload temp image: ${uploadError.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * POST /api/generate
 *
 * Step 1: Generate TTS audio
 * Step 2: Crop avatar image
 * Step 3: Start video generation (Vidnoz or WaveSpeed based on videoModel)
 *
 * Frontend should poll /api/video/[taskId] or /api/video/wavespeed/[requestId] for status
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const {
      transcript,
      aspectRatio,
      speakerId,
      avatarUrl,
      videoModel = 'vidnoz' as VideoModel,
      waveSpeedPrompt = DEFAULT_WAVESPEED_PROMPT,
      waveSpeedResolution = '720p' as WaveSpeedResolution,
    } = body

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'Transcript is required',
      })
    }
    if (!speakerId) {
      throw createError({
        statusCode: 400,
        message: 'Speaker ID is required',
      })
    }
    if (!avatarUrl) {
      throw createError({
        statusCode: 400,
        message: 'Avatar URL is required',
      })
    }

    console.log('Starting video generation process...')
    console.log({
      transcript: transcript.substring(0, 50) + '...',
      speakerId,
      avatarUrl,
      videoModel,
    })

    // 1. Generate audio from TOPMEDIAI TTS
    console.log('Calling TOPMEDIAI TTS...')
    const { audioUrl: topMediaiAudioUrl } = await textToSpeech(transcript, speakerId)
    console.log('TOPMEDIAI TTS audio generated:', topMediaiAudioUrl)

    // 2. Crop avatar image to target aspect ratio
    console.log('Cropping avatar image to aspect ratio:', aspectRatio)
    const croppedBuffer = await cropImageToAspectRatio({
      imageUrl: avatarUrl,
      aspectRatio: aspectRatio || 'portrait'
    })
    console.log('Cropped avatar buffer size:', croppedBuffer.length, 'bytes')

    let taskId: string
    let pollEndpoint: 'vidnoz' | 'wavespeed'

    if (videoModel === 'wavespeed') {
      // WaveSpeed flow: needs image URL, not buffer
      console.log('Using WaveSpeed for video generation...')

      // Upload cropped image to get a URL
      const tempFilename = `wavespeed_${Date.now()}.jpg`
      const croppedImageUrl = await uploadTempImage(croppedBuffer, tempFilename)
      console.log('Cropped image uploaded to:', croppedImageUrl)

      // Call WaveSpeed API
      const { requestId } = await generateWaveSpeedVideo({
        audioUrl: topMediaiAudioUrl,
        imageUrl: croppedImageUrl,
        prompt: waveSpeedPrompt,
        resolution: waveSpeedResolution,
      })
      console.log('WaveSpeed task started, requestId:', requestId)

      taskId = requestId
      pollEndpoint = 'wavespeed'
    } else {
      // Vidnoz flow: uses buffer directly
      console.log('Using Vidnoz for video generation...')
      const { taskId: vidnozTaskId } = await generateTalkingVideoWithBuffer(croppedBuffer, topMediaiAudioUrl)
      console.log('Vidnoz task started, taskId:', vidnozTaskId)

      taskId = vidnozTaskId
      pollEndpoint = 'vidnoz'
    }

    // Return taskId immediately - frontend will poll for status
    return {
      id: Date.now().toString(),
      taskId,
      videoModel,
      pollEndpoint,
      transcript,
      aspectRatio,
      audioUrl: topMediaiAudioUrl,
      createdAt: new Date().toISOString(),
      status: 'generating', // Frontend should poll for completion
    }
  } catch (error: any) {
    console.error('Generation API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate video',
      data: { details: error.message },
    })
  }
})
