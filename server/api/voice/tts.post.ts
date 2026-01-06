import { textToSpeech } from '~/server/utils/inworld'
import { fixPronunciation } from '~/server/utils/pronunciationFix'
import { getTokenBalance, consumeTokens, initializeUserSubscription } from '~/server/utils/subscription/tokenService'
import { estimateDurationFromTranscript, calculateTtsTokenCost } from '~/types/subscription'

/**
 * POST /api/voice/tts
 *
 * Generate speech using an existing cloned voice (speakerId).
 * This skips the voice cloning step and directly calls TTS.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { speakerId, transcript, userId } = body

    if (!speakerId) {
      throw createError({
        statusCode: 400,
        message: 'speakerId is required',
      })
    }

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'transcript is required',
      })
    }

    // 計算 Token 成本
    const durationSeconds = estimateDurationFromTranscript(transcript)
    const estimatedCost = calculateTtsTokenCost(durationSeconds)

    // 如果有 userId，檢查餘額並扣除 Token
    let tokenConsumed = 0
    let balanceAfter = 0

    if (userId) {
      // 檢查餘額
      let balance = await getTokenBalance(userId)
      if (!balance) {
        const init = await initializeUserSubscription(userId)
        balance = init.balance
      }

      if (balance.balance < estimatedCost) {
        throw createError({
          statusCode: 402,
          message: `Token 餘額不足，需要 ${estimatedCost} Token，目前餘額 ${balance.balance}`,
        })
      }

      // 執行 TTS（應用發音校正）
      const ttsText = fixPronunciation(transcript)
      const { audioUrl } = await textToSpeech(ttsText, speakerId)

      // TTS 成功後扣除 Token
      const consumeResult = await consumeTokens({
        userId,
        operationType: 'tts',
        customCost: estimatedCost,
        description: `語音生成 (${Math.ceil(durationSeconds)}秒)`,
      })

      tokenConsumed = estimatedCost
      balanceAfter = consumeResult.balanceAfter

      return {
        success: true,
        speakerId,
        audioUrl,
        transcript: transcript.substring(0, 500),
        tokenConsumed,
        balanceAfter,
      }
    }

    // 沒有 userId 的情況（向下相容）
    const ttsTextNoUser = fixPronunciation(transcript)
    const { audioUrl } = await textToSpeech(ttsTextNoUser, speakerId)

    return {
      success: true,
      speakerId,
      audioUrl,
      transcript: transcript.substring(0, 500),
    }
  } catch (error: any) {
    console.error('TTS API Error:', error)

    // Map specific errors to HTTP responses
    if (error.message?.includes('Speaker not found')) {
      throw createError({
        statusCode: 404,
        message: error.message,
      })
    }

    if (error.message?.includes('API key not configured') || error.message?.includes('required')) {
      throw createError({
        statusCode: 400,
        message: error.message,
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      data: { details: String(error) },
    })
  }
})
