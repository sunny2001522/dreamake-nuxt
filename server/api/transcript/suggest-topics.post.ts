import { GoogleGenerativeAI } from '@google/generative-ai'
import { nanoid } from 'nanoid'

interface SuggestTopicsRequest {
  persona_content: string
}

interface TopicItem {
  title: string
  description: string
  estimatedDuration: string
}

/**
 * POST /api/transcript/suggest-topics
 *
 * 基於人格/風格分析，使用 Gemini 生成 5 個建議主題
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
    const body: SuggestTopicsRequest = await readBody(event)
    const { persona_content } = body

    if (!persona_content || persona_content.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: '請輸入人格/風格描述',
      })
    }

    // 初始化 Gemini
    const genAI = new GoogleGenerativeAI(config.geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 構造 Prompt
    const prompt = `你是一個專業的短影音內容策劃師，專門為台灣 KOL 和內容創作者規劃爆紅短影音主題。

【創作者人格/風格分析】
${persona_content}

請根據以上創作者的風格分析，仔細識別創作者的：
1. **專業領域/主題範疇**（如：股票投資、理財、美食、旅遊、科技、生活等）
2. 風格特色（說話方式、常用語）
3. 目標受眾

⚠️ 【最重要】生成的主題必須與創作者的專業領域直接相關！
- 如果是股票/投資頻道 → 主題應關於股票、投資策略、財經分析、投資心法
- 如果是美食頻道 → 主題應關於美食、料理、餐廳推薦
- 如果是科技頻道 → 主題應關於科技產品、3C開箱、技術教學
- 如果是理財頻道 → 主題應關於理財規劃、存錢技巧、財務自由
- 請勿生成與創作者專業領域無關的主題（例如：股票頻道不應推薦 AI 繪圖教學）

要求：
1. 主題必須與創作者的專業領域高度相關（這是最重要的！）
2. 主題要具體且有話題性，容易引起觀眾共鳴
3. 適合 60-90 秒的短影音格式
4. 符合創作者的人設和風格
5. 有潛力獲得高互動（按讚、留言、分享）

回傳格式（嚴格 JSON 陣列）：
[
  {
    "title": "主題標題（簡潔有力，10字以內）",
    "description": "簡短說明這個主題為什麼適合這位創作者（20字以內）",
    "estimatedDuration": "60-90秒"
  }
]

只回傳 JSON 陣列，不要任何其他文字、說明或 markdown 格式。`

    // 呼叫 Gemini
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // 清理可能的 markdown 格式
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // 解析 JSON
    let topics: TopicItem[]
    try {
      topics = JSON.parse(cleanedResponse)
    } catch {
      console.error('Failed to parse Gemini response:', cleanedResponse)
      throw createError({
        statusCode: 500,
        message: '主題生成格式錯誤，請重試',
      })
    }

    // 驗證並添加 ID
    if (!Array.isArray(topics) || topics.length === 0) {
      throw createError({
        statusCode: 500,
        message: '未能生成有效的主題建議',
      })
    }

    // 為每個主題添加唯一 ID
    const topicsWithIds = topics.slice(0, 5).map((topic) => ({
      id: nanoid(),
      title: topic.title || '未命名主題',
      description: topic.description || '',
      estimatedDuration: topic.estimatedDuration || '60-90秒',
    }))

    console.log('Generated topics:', topicsWithIds.length)

    return {
      success: true,
      topics: topicsWithIds,
    }
  } catch (error: any) {
    console.error('Suggest Topics API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '主題建議生成失敗，請稍後再試',
      data: { details: String(error) },
    })
  }
})
