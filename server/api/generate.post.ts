import { textToSpeech } from '~/server/utils/inworld'
import { generateTalkingVideoWithBuffer } from '~/server/utils/vidnoz'
import { generateWaveSpeedVideo, DEFAULT_WAVESPEED_PROMPT } from '~/server/utils/wavespeed'
import { cropImageToAspectRatio } from '~/server/utils/image/serverImageProcessor'
import { STORAGE_BUCKET } from '~/server/utils/supabase'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { getTokenBalance, consumeTokens, initializeUserSubscription } from '~/server/utils/subscription/tokenService'
import { VIDEO_TOKEN_COSTS, estimateDurationFromTranscript } from '~/types/subscription'
import type { VideoModel, WaveSpeedResolution } from '~/types'

// Base Token cost for video generation
const VIDEO_BASE_TOKEN = 2

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
      userId,
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

    // Calculate estimated Token cost
    const durationSeconds = estimateDurationFromTranscript(transcript)
    const model = videoModel as 'wavespeed' | 'vidnoz'
    const perSecondCost = VIDEO_TOKEN_COSTS[model].perSecond
    const estimatedCost = VIDEO_BASE_TOKEN + Math.round(perSecondCost * durationSeconds)

    // Check Token balance before generation
    if (userId) {
      let balance = await getTokenBalance(userId)
      if (!balance) {
        const result = await initializeUserSubscription(userId)
        balance = result.balance
      }

      console.log('Video generation - Token check:', {
        userId,
        required: estimatedCost,
        balance: balance.balance,
        model: videoModel,
        durationSeconds,
      })

      if (balance.balance < estimatedCost) {
        throw createError({
          statusCode: 402,
          message: `Token 餘額不足，需要約 ${estimatedCost} Token，目前餘額 ${balance.balance}`,
        })
      }
    }

    console.log('Starting video generation process...')
    console.log({
      transcript: transcript.substring(0, 50) + '...',
      speakerId,
      avatarUrl,
      videoModel,
    })

    // 1. Generate audio from Inworld TTS
    console.log('Calling Inworld TTS...')
    const { audioUrl: ttsAudioUrl } = await textToSpeech(transcript, speakerId)
    console.log('Inworld TTS audio generated:', ttsAudioUrl)

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
        audioUrl: ttsAudioUrl,
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
      const { taskId: vidnozTaskId } = await generateTalkingVideoWithBuffer(croppedBuffer, ttsAudioUrl)
      console.log('Vidnoz task started, taskId:', vidnozTaskId)

      taskId = vidnozTaskId
      pollEndpoint = 'vidnoz'
    }

    // Consume Token after successful generation start
    let tokenConsumed = 0
    let balanceAfter = 0
    if (userId) {
      const consumeResult = await consumeTokens({
        userId,
        operationType: 'video_generation',
        description: `影片生成 (${videoModel === 'wavespeed' ? '高品質' : '一般品質'})`,
        metadata: { videoModel, durationSeconds, taskId },
        customCost: estimatedCost,
      })

      if (consumeResult.success) {
        tokenConsumed = consumeResult.consumed
        balanceAfter = consumeResult.balanceAfter
        console.log('Video generation - Token consumed:', consumeResult)
      } else {
        console.error('Video generation - Token deduction failed:', consumeResult.error)
      }
    }

    // Return taskId immediately - frontend will poll for status
    return {
      id: Date.now().toString(),
      taskId,
      videoModel,
      pollEndpoint,
      transcript,
      aspectRatio,
      audioUrl: ttsAudioUrl,
      createdAt: new Date().toISOString(),
      status: 'generating', // Frontend should poll for completion
      tokenConsumed,
      balanceAfter,
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
