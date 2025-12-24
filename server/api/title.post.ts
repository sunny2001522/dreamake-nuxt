import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * POST /api/title
 *
 * Uses Gemini AI to generate a catchy short video title based on the transcript.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.geminiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'Gemini API key not configured',
    })
  }

  try {
    const { transcript } = await readBody(event)

    if (!transcript) {
      throw createError({
        statusCode: 400,
        message: 'Transcript is required',
      })
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `根據以下逐字稿內容，生成一個適合放在短影片（如 TikTok、Reels、Shorts）頂部的吸睛標題。

規則：
1. 標題分成兩行，用換行符號分隔
2. 每行最多 8 個字
3. 要能吸引觀眾注意力，可以使用驚嘆、疑問或情緒化的語氣
4. 不要使用標點符號（不要逗號、句號、分號、冒號）
5. 不要使用 hashtag
6. 只輸出標題文字（兩行），不要有任何其他解釋

逐字稿內容：
${transcript}`

    const result = await model.generateContent(prompt)
    let title = result.response.text().trim()

    // Post-process: if title contains punctuation or space, split into two lines
    if (!title.includes('\n')) {
      // Split on space, comma, period, semicolon, colon
      title = title.replace(/[ ，,。.；;：:]/g, '\n')
    }

    // Remove any remaining punctuation
    title = title.replace(/[，,。.；;：:！!？?]/g, '')

    console.log('Generated title:', title)

    return { title }
  } catch (error: any) {
    console.error('Title API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate title',
      data: { details: String(error) },
    })
  }
})
