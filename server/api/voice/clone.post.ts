import { cloneVoice } from '~/server/utils/topmediai'

const MAX_FILES = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file

/**
 * POST /api/voice/clone
 *
 * Clone-only endpoint: Accepts one or more audio files (up to 20) and clones the voice.
 * Multiple files improve voice cloning accuracy.
 * Returns the speakerId for later use with TTS.
 * Does NOT generate speech - use /api/voice/tts for that.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.topMediaiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'TopMediai API key not configured',
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
    const audioFiles: { data: ArrayBuffer; filename: string; type: string }[] = []
    let voiceName = `voice_${Date.now()}`

    for (const field of formData) {
      if (field.name === 'audio' && field.data) {
        audioFiles.push({
          data: field.data.buffer.slice(
            field.data.byteOffset,
            field.data.byteOffset + field.data.byteLength
          ) as ArrayBuffer,
          filename: field.filename || 'audio.mp3',
          type: field.type || 'audio/mpeg',
        })
      } else if (field.name === 'voiceName') {
        voiceName = field.data.toString('utf-8')
      }
    }

    // Validate file count
    if (audioFiles.length === 0) {
      throw createError({
        statusCode: 400,
        message: '請至少上傳一個音檔',
      })
    }

    if (audioFiles.length > MAX_FILES) {
      throw createError({
        statusCode: 400,
        message: `最多只能上傳 ${MAX_FILES} 個音檔`,
      })
    }

    // Validate individual file sizes
    for (const file of audioFiles) {
      console.log('Voice clone - file info:', {
        filename: file.filename,
        type: file.type,
        size: file.data.byteLength,
      })

      if (file.data.byteLength > MAX_FILE_SIZE) {
        throw createError({
          statusCode: 400,
          message: `檔案 ${file.filename} 超過 10MB 限制`,
        })
      }

      // Check minimum file size
      if (file.data.byteLength < 1000) {
        console.error('Voice clone - file too small:', file.data.byteLength)
        throw createError({
          statusCode: 400,
          message: `音檔太小 (${file.data.byteLength} bytes)，請確認錄音是否正確`,
        })
      }
    }

    // Clone the voice from uploaded audio files
    const { speakerId } = await cloneVoice(audioFiles, voiceName)

    console.log('Voice cloned successfully, speaker ID:', speakerId)

    return {
      success: true,
      speakerId,
    }
  } catch (error: any) {
    console.error('Voice Clone API Error:', error)

    // Check for permission issues
    if (error.message?.includes('permission') || error.message?.includes('subscription')) {
      throw createError({
        statusCode: 403,
        message: 'TopMediai API 帳戶沒有語音克隆權限，請至 https://www.topmediai.com/api/voice-cloning-api/ 購買訂閱',
      })
    }

    // Check for format issues
    if (error.message?.includes('format') || error.message?.includes('unsupported') || error.message?.includes('invalid')) {
      throw createError({
        statusCode: 400,
        message: `音檔格式不支援: ${error.message}。建議使用 MP3 或 WAV 格式。`,
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      data: { details: String(error) },
    })
  }
})
