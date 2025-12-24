import { GoogleGenerativeAI } from '@google/generative-ai'

interface GenerateRequest {
  topic: string
  persona_analysis?: string
}

/**
 * POST /api/transcript/generate
 *
 * 使用 Gemini AI 生成短影音腳本
 * 包含：開場 + 內容 + CTA 結尾
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
    const body: GenerateRequest = await readBody(event)
    const { topic, persona_analysis } = body

    if (!topic || topic.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: '請輸入主題',
      })
    }

    // 初始化 Gemini
    const genAI = new GoogleGenerativeAI(config.geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 構造 Prompt
    const prompt = `你是一個專業的短影音腳本撰寫專家，專門為台灣觀眾創作爆紅短影音內容。

${persona_analysis ? `【創作者風格分析】
${persona_analysis}

⚠️ 【最重要】請完整模仿這位創作者的風格：

1. **固定開場白**：如果分析中有固定的開場白（如「大家好，我是XX」），請一字不差地使用！
2. **口頭禪和語氣詞**：完整模仿創作者的口頭禪、語氣詞（如「對吧」「你說是不是」「真的假的」）
3. **固定結尾 CTA**：如果分析中有固定的結尾格式（如按讚訂閱、VIP推廣、風險提醒），請完整模仿該結構！
4. **說話邏輯**：模仿創作者的論述方式、舉例風格、互動方式

你的目標是讓觀眾聽不出這是 AI 生成的，要像是創作者本人寫的腳本。
` : ''}

【主題】
${topic}

請撰寫一個 60-90 秒的爆紅短影音腳本。

${persona_analysis ? `腳本結構要求（根據創作者風格調整）：
1. 開場：使用創作者的固定開場白 + 引起好奇的開頭
2. 內容（40-60秒）：3-5 個重點，模仿創作者的說話方式和舉例風格
3. CTA 結尾：模仿創作者的固定結尾格式（如有 VIP 推廣、風險提醒等要完整保留）` : `腳本結構要求：
1. 開場（5-10秒）：用驚人事實、反常識觀點、或直接的問題抓住觀眾注意力
2. 內容（40-60秒）：3-5 個重點，每個重點簡潔有力，用口語化的方式解釋
3. CTA 結尾（5-10秒）：呼籲行動，例如「如果覺得有幫助，記得按讚分享」`}

寫作規則：
- 語氣要口語化、親切、有溫度，像在跟朋友聊天
- 避免使用艱澀詞彙和書面用語
- 每句話不超過 15 個字
- 適時使用語氣詞
- 可以用反問句增加互動感
- 直接輸出腳本文字，不要有【開場】【內容】【CTA】等標記
- 不要有編號、破折號或其他格式符號
- 不要輸出任何解釋或說明
- 使用標準國語，避免使用台語、閩南語詞彙（AI TTS 無法正確發音）
- 避免使用「捏」「啦」等 AI TTS 聲調發音不正確的字詞
- 語氣詞可用「呢」「嗎」「吧」「喔」「耶」「欸」「哦」等替代

現在開始生成腳本：`

    // 呼叫 Gemini
    const result = await model.generateContent(prompt)
    let transcript = result.response.text().trim()

    // 後處理：移除可能的格式標記
    transcript = transcript
      .replace(/【[^】]+】/g, '') // 移除【】標記
      .replace(/\[.*?\]/g, '')    // 移除 [] 標記
      .replace(/^[\d\.\-\*]+\s*/gm, '') // 移除行首編號
      .replace(/\n{3,}/g, '\n\n') // 合併多餘空行
      .trim()

    console.log('Generated transcript length:', transcript.length)

    return {
      success: true,
      transcript,
    }
  } catch (error: any) {
    console.error('Transcript Generate API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '腳本生成失敗，請稍後再試',
      data: { details: String(error) },
    })
  }
})
