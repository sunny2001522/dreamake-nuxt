import { cloneVoice } from '~/server/utils/inworld'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { consumeTokens, getTokenBalance, initializeUserSubscription } from '~/server/utils/subscription/tokenService'

const MAX_FILES = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const CLONE_TOKEN_COST = 10

/**
 * POST /api/voice/clone
 *
 * Clone-only endpoint: Accepts one or more audio files (up to 20) and clones the voice.
 * Multiple files improve voice cloning accuracy.
 * Returns the speakerId for later use with TTS.
 * Does NOT generate speech - use /api/voice/tts for that.
 *
 * Token cost: 10 Token per clone (charged after successful clone).
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
    const audioFiles: { data: ArrayBuffer; filename: string; type: string }[] = []
    let voiceName = `voice_${Date.now()}`
    let userId = ''

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
      } else if (field.name === 'voiceName' || field.name === 'name') {
        voiceName = field.data.toString('utf-8')
      } else if (field.name === 'userId') {
        userId = field.data.toString('utf-8')
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

    // Check Token balance (don't deduct yet)
    if (userId) {
      // Ensure user has Token balance
      let balance = await getTokenBalance(userId)
      if (!balance) {
        const result = await initializeUserSubscription(userId)
        balance = result.balance
      }

      console.log('Voice clone - Token check:', { userId, required: CLONE_TOKEN_COST, balance: balance.balance })

      if (balance.balance < CLONE_TOKEN_COST) {
        throw createError({
          statusCode: 402,
          message: `Token 餘額不足，需要 ${CLONE_TOKEN_COST} Token，目前餘額 ${balance.balance}`,
        })
      }
    }

    // Clone the voice from uploaded audio files
    const { speakerId } = await cloneVoice(audioFiles, voiceName)

    console.log('Voice cloned successfully, speaker ID:', speakerId)

    // Deduct Token after successful clone
    if (userId) {
      const consumeResult = await consumeTokens({
        userId,
        operationType: 'voice_clone',
        description: `語音克隆: ${voiceName}`,
        metadata: { voiceName },
      })

      if (!consumeResult.success) {
        console.error('Voice clone - Token deduction failed:', consumeResult.error)
        // Clone succeeded but billing failed - log but don't fail the request
      } else {
        console.log('Voice clone - Token consumed:', consumeResult)
      }
    }

    return {
      success: true,
      speakerId,
    }
  } catch (error: any) {
    console.error('Voice Clone API Error:', error)

    // Check for permission issues
    if (error.message?.includes('permission') || error.message?.includes('subscription') || error.message?.includes('unauthorized')) {
      throw createError({
        statusCode: 403,
        message: 'Inworld API 帳戶沒有語音克隆權限，請檢查 API key 設定',
      })
    }

    // Check for workspace issues
    if (error.message?.includes('workspace') || error.message?.includes('Workspace')) {
      throw createError({
        statusCode: 400,
        message: 'Inworld Workspace ID 設定錯誤，請確認環境變數 INWORLD_WORKSPACE_ID',
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
