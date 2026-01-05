import { fixPronunciation } from '~/server/utils/pronunciationFix'
import { textToSpeech, cloneVoice } from '~/server/utils/inworld'

/**
 * POST /api/voice
 *
 * Accepts an audio file and transcript, clones the voice,
 * then generates speech from the transcript using the cloned voice.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.inworldApiKey) {
    throw createError({
      statusCode: 500,
      message: 'Inworld API key not configured',
    })
  }

  if (!config.inworldWorkspaceId) {
    throw createError({
      statusCode: 500,
      message: 'Inworld Workspace ID not configured',
    })
  }

  try {
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: 'No form data received',
      })
    }

    // Extract fields from form data
    let audioFile: { data: Buffer; filename: string; type: string } | null = null
    let transcript: string | null = null
    let voiceName = `voice_${Date.now()}`

    for (const field of formData) {
      if (field.name === 'audio' && field.data) {
        audioFile = {
          data: field.data,
          filename: field.filename || 'audio.mp3',
          type: field.type || 'audio/mpeg',
        }
      } else if (field.name === 'transcript') {
        transcript = field.data.toString('utf-8')
      } else if (field.name === 'voiceName') {
        voiceName = field.data.toString('utf-8')
      }
    }

    if (!audioFile) {
      throw createError({
        statusCode: 400,
        message: 'Audio file is required',
      })
    }

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'Transcript is required',
      })
    }

    // Step 1: Clone the voice from uploaded audio
    console.log('Voice clone - Starting with voice name:', voiceName)

    const { speakerId } = await cloneVoice(
      [{
        data: audioFile.data.buffer.slice(
          audioFile.data.byteOffset,
          audioFile.data.byteOffset + audioFile.data.byteLength
        ) as ArrayBuffer,
        filename: audioFile.filename,
        type: audioFile.type,
      }],
      voiceName
    )

    console.log('Voice cloned successfully, speaker ID:', speakerId)

    // Step 2: Generate speech using the cloned voice
    // Apply pronunciation fix for Taiwan accent (affects TTS only, not subtitles)
    const ttsText = fixPronunciation(transcript.substring(0, 500))
    console.log('Original transcript:', transcript.substring(0, 100))
    console.log('TTS text (pronunciation fixed):', ttsText.substring(0, 100))

    const { audioUrl } = await textToSpeech(ttsText, speakerId)

    console.log('TTS generated successfully:', audioUrl)

    return {
      success: true,
      speakerId,
      audioUrl,
      transcript: transcript.substring(0, 500),
    }
  } catch (error: any) {
    console.error('Voice API Error:', error)

    // Check for specific error types
    if (error.message?.includes('permission') || error.message?.includes('subscription') || error.message?.includes('unauthorized')) {
      throw createError({
        statusCode: 403,
        message: 'Inworld API 帳戶沒有語音克隆權限，請檢查 API key 設定',
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      data: { details: String(error) },
    })
  }
})
