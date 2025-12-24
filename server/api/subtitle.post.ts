import { GoogleGenerativeAI } from '@google/generative-ai'
import type { TimedSegment } from '~/types'
import { transcribeAudio, isWhisperAvailable, alignTranscriptWithWhisperTimings } from '~/server/utils/whisper'

/**
 * POST /api/subtitle
 *
 * Generates timed subtitle segments from audio.
 * Priority: OpenAI Whisper API (accurate) -> Gemini AI (fallback) -> Text-only (last resort)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  try {
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: 'No form data received',
      })
    }

    // Extract fields
    let audioFile: { data: Buffer; filename: string; type: string } | null = null
    let transcript: string | null = null

    for (const field of formData) {
      if (field.name === 'audio' && field.data) {
        audioFile = {
          data: field.data,
          filename: field.filename || 'audio.mp3',
          type: field.type || 'audio/mpeg',
        }
      } else if (field.name === 'transcript') {
        transcript = field.data.toString('utf-8')
      }
    }

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'Transcript is required',
      })
    }

    // ============================================
    // Priority 1: OpenAI Whisper API (most accurate)
    // ============================================
    if (audioFile && isWhisperAvailable()) {
      try {
        console.log('Attempting Whisper transcription...')

        const whisperResult = await transcribeAudio(
          audioFile.data,
          audioFile.filename,
          'zh' // Traditional Chinese
        )

        if (whisperResult.words && whisperResult.words.length > 0) {
          // Use alignTranscriptWithWhisperTimings to preserve original Traditional Chinese text
          // while using Whisper's accurate timestamps (avoids Simplified Chinese conversion)
          const segments = alignTranscriptWithWhisperTimings(transcript, whisperResult.words)
          console.log(`Whisper success (aligned with original text): ${segments.length} segments, duration=${whisperResult.duration}s`)

          return {
            segments,
            hasTimestamps: true,
            source: 'whisper',
            duration: whisperResult.duration
          }
        }

        console.warn('Whisper returned no words, falling back to Gemini')
      } catch (whisperError) {
        console.error('Whisper API error:', whisperError)
        // Fall through to Gemini
      }
    }

    // ============================================
    // Priority 2: Gemini AI (fallback)
    // ============================================
    if (!config.geminiApiKey) {
      console.warn('No GEMINI_API_KEY, using text-only fallback')
    } else if (audioFile) {
      const genAI = new GoogleGenerativeAI(config.geminiApiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      try {
        console.log('Falling back to Gemini audio analysis...')
        const base64Audio = audioFile.data.toString('base64')

        const prompt = `你是一個專業的字幕製作師。請仔細聽這段音檔，為以下文字製作精準的字幕時間軸。

【字數規則】每段字幕 6-10 個中文字

【斷句規則】
1. 在說話者的自然停頓處斷句
2. 「的」「了」「著」等助詞跟前面的詞放一起
3. 語助詞（嗎、呢、吧、啊、喔、耶、啦、囉）跟前句放一起
4. 移除所有標點符號（逗號、句號、問號、驚嘆號等）

【時間戳規則 - 非常重要】
1. 仔細聽音檔中每個字的發音時間點
2. startTime = 這段字幕第一個字開始發音的時間
3. endTime = 這段字幕最後一個字說完的時間
4. 字幕的顯示時間要足夠讓觀眾閱讀（每段至少 1-2 秒）
5. 不要讓字幕切換太快，要跟著說話的節奏
6. 時間單位是秒，精確到小數點後一位

文字內容：
${transcript}

只輸出 JSON 陣列，不要有任何其他文字：
[{"text": "大家好我是小明", "startTime": 0.0, "endTime": 2.0}, {"text": "今天要跟大家分享", "startTime": 2.0, "endTime": 4.0}, ...]`

        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: audioFile.type,
              data: base64Audio
            }
          }
        ])

        const responseText = result.response.text()
        console.log('Gemini audio analysis response:', responseText.substring(0, 200))

        // Extract JSON array from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const segments: TimedSegment[] = JSON.parse(jsonMatch[0])
          console.log('Gemini timed subtitle segments:', segments.length, 'segments')
          return { segments, hasTimestamps: true, source: 'gemini' }
        }

        console.warn('Failed to parse JSON from Gemini response, falling back to text-only mode')
      } catch (audioError) {
        console.error('Audio analysis error:', audioError)
        // Fall through to text-only mode
      }
    }

    // ============================================
    // Priority 3: Text-only segmentation (last resort)
    // ============================================
    console.log('Using text-only segmentation (no timestamps)')

    // Try Gemini for text segmentation if available
    if (config.geminiApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey)
        const textModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const textPrompt = `將以下文字分段為字幕格式。

【最重要】每段字幕必須控制在 6-10 個中文字！

斷句規則：
1. 每段必須 6-10 個字，太短要合併，太長要拆分
2. 在自然停頓處斷句：逗號、句號、問號、驚嘆號
3. 「的」「了」「著」等助詞要跟前面的詞放一起
4. 語助詞（嗎、呢、吧、啊、喔、耶、啦、囉）跟前句放一起
5. 超過 10 字的句子，找最自然的位置拆成兩段
6. 移除所有標點符號，輸出不要有任何標點

輸出格式：
- 每行一段字幕
- 不要有編號、破折號或其他格式
- 不要輸出任何解釋或說明

文字：
${transcript}`

        const result = await textModel.generateContent(textPrompt)
        const text = result.response.text()

        const textSegments = text
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0)

        const segments: TimedSegment[] = textSegments.map((segText) => ({
          text: segText,
          startTime: -1,
          endTime: -1
        }))

        console.log('Gemini text-only segments:', segments.length, 'segments')
        return { segments, hasTimestamps: false, source: 'gemini-text' }
      } catch (textError) {
        console.error('Gemini text segmentation error:', textError)
      }
    }

    // Ultimate fallback: simple punctuation-based segmentation
    const simpleSegments = simpleTextSegmentation(transcript)
    console.log('Simple text segmentation:', simpleSegments.length, 'segments')
    return { segments: simpleSegments, hasTimestamps: false, source: 'fallback' }

  } catch (error: any) {
    console.error('Subtitle API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate subtitle segments',
      data: { details: String(error) },
    })
  }
})

/**
 * Simple punctuation-based text segmentation (ultimate fallback).
 * Splits text by punctuation and groups into 6-10 character segments.
 */
function simpleTextSegmentation(transcript: string): TimedSegment[] {
  // Remove punctuation and split by natural breaks
  const cleanText = transcript
    .replace(/[，。！？、；：,\.!?\-—\[\]【】「」『』：""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const segments: TimedSegment[] = []
  let currentSegment = ''

  for (const char of cleanText) {
    currentSegment += char

    // Check character count (Chinese chars count as 1, ASCII as 0.5)
    let charCount = 0
    for (const c of currentSegment) {
      charCount += c.charCodeAt(0) > 127 ? 1 : 0.5
    }

    // Break at 8+ characters (target middle of 6-10 range)
    if (charCount >= 8 || (charCount >= 6 && char === ' ')) {
      const trimmed = currentSegment.trim()
      if (trimmed.length > 0) {
        segments.push({
          text: trimmed,
          startTime: -1,
          endTime: -1
        })
      }
      currentSegment = ''
    }
  }

  // Handle remaining text
  const remaining = currentSegment.trim()
  if (remaining.length > 0) {
    // If too short, merge with previous segment
    if (segments.length > 0 && remaining.length < 4) {
      segments[segments.length - 1].text += remaining
    } else {
      segments.push({
        text: remaining,
        startTime: -1,
        endTime: -1
      })
    }
  }

  return segments
}
