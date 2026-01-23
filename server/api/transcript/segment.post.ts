import { GoogleGenerativeAI } from '@google/generative-ai'
import { nanoid } from 'nanoid'
import type { TranscriptSegment } from '~/types'

interface SegmentRequest {
  transcript: string
}

interface SegmentResponse {
  success: boolean
  segments: TranscriptSegment[]
}

/**
 * POST /api/transcript/segment
 *
 * 使用 Gemini AI 將逐字稿按語意分段
 * 約 2-4 句話一段，便於分段生成和 Whisper 對齊
 */
export default defineEventHandler(async (event): Promise<SegmentResponse> => {
  const config = useRuntimeConfig()

  if (!config.geminiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'Gemini API key not configured',
    })
  }

  try {
    const body: SegmentRequest = await readBody(event)
    const { transcript } = body

    if (!transcript || transcript.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: '請輸入逐字稿',
      })
    }

    // 如果逐字稿太短，直接返回單一段落
    if (transcript.length < 100) {
      return {
        success: true,
        segments: [
          {
            id: nanoid(),
            index: 0,
            text: transcript.trim(),
          },
        ],
      }
    }

    // 初始化 Gemini
    const genAI = new GoogleGenerativeAI(config.geminiApiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    // 構造 Prompt
    const prompt = `你是一個專業的短影音分段專家。請將以下逐字稿按語意分成多個段落。

【分段規則】
1. 每段約 2-4 句話（約 100-200 字）
2. 在語意完整處斷點：
   - 話題轉換
   - 論點結束
   - 段落結尾
   - 問答交替
3. 避免在句子中間斷開
4. 段落數控制在 3-6 段
5. 保持每段長度相近，便於平行處理

【逐字稿】
${transcript}

【輸出格式】
請以 JSON 陣列格式輸出，每個元素包含 index 和 text：
[
  {"index": 0, "text": "第一段內容..."},
  {"index": 1, "text": "第二段內容..."}
]

注意：
- 保留原文用字，不要修改或潤飾
- 不要加入或移除標點符號
- 直接輸出 JSON，不要有其他文字`

    // 呼叫 Gemini
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // 解析 JSON
    let parsedSegments: Array<{ index: number; text: string }>
    try {
      parsedSegments = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', responseText)
      // 如果解析失敗，嘗試提取 JSON 部分
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsedSegments = JSON.parse(jsonMatch[0])
      } else {
        // 降級：直接用簡單分段
        parsedSegments = simpleSegment(transcript)
      }
    }

    // 驗證並轉換為 TranscriptSegment
    const segments: TranscriptSegment[] = parsedSegments.map((seg, idx) => ({
      id: nanoid(),
      index: seg.index ?? idx,
      text: seg.text.trim(),
    }))

    // 確保至少有一個段落
    if (segments.length === 0) {
      return {
        success: true,
        segments: [
          {
            id: nanoid(),
            index: 0,
            text: transcript.trim(),
          },
        ],
      }
    }

    console.log(`Segmented transcript into ${segments.length} parts`)

    return {
      success: true,
      segments,
    }
  } catch (error: any) {
    console.error('Transcript Segment API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '逐字稿分段失敗，請稍後再試',
      data: { details: String(error) },
    })
  }
})

/**
 * 簡單分段（降級方案）
 * 根據標點符號和字數進行基本分段
 */
function simpleSegment(transcript: string): Array<{ index: number; text: string }> {
  // 用句號、問號、驚嘆號分割
  const sentences = transcript.split(/(?<=[。！？\n])/g).filter(s => s.trim())

  const segments: Array<{ index: number; text: string }> = []
  let currentSegment = ''
  let segmentIndex = 0

  for (const sentence of sentences) {
    currentSegment += sentence

    // 如果當前段落超過 150 字，或累積了 3-4 句話，就開始新段落
    if (currentSegment.length >= 150 || (currentSegment.match(/[。！？]/g)?.length ?? 0) >= 3) {
      segments.push({
        index: segmentIndex++,
        text: currentSegment.trim(),
      })
      currentSegment = ''
    }
  }

  // 處理剩餘的文字
  if (currentSegment.trim()) {
    segments.push({
      index: segmentIndex,
      text: currentSegment.trim(),
    })
  }

  return segments
}
