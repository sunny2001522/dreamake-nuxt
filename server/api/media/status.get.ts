/**
 * 帶重試機制的 fetch
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  throw new Error('Max retries exceeded')
}

/**
 * GET /api/media/status?job_id=xxx
 *
 * 查詢媒體分析任務狀態和結果
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const mediaApiUrl = config.youtubeAnalysisApiUrl || 'https://development-agentgenerator.cmoney.tw'

  try {
    const query = getQuery(event)
    const job_id = query.job_id as string

    if (!job_id) {
      throw createError({
        statusCode: 400,
        message: 'job_id is required',
      })
    }

    const response = await fetchWithRetry(
      `${mediaApiUrl}/api/media/result?job_id=${job_id}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    )

    // 404 = 任務尚未完成
    if (response.status === 404) {
      return {
        status: 'pending',
        message: '任務處理中'
      }
    }

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: '查詢服務暫時無法使用',
        data: { status: 'error' },
      })
    }

    const contentType = response.headers.get('content-type')

    // JSON 響應
    if (contentType?.includes('application/json')) {
      const result = await response.json()

      // 檢查 not_found 錯誤
      if (result.error === 'not_found') {
        return {
          status: 'processing',
          message: '正在分析中'
        }
      }

      // 有結果
      if (result.result) {
        return {
          status: 'completed',
          result: result.result,
          progress: result.progress
        }
      }

      // 其他狀態
      return {
        status: result.status || 'pending',
        message: result.message,
        progress: result.progress
      }
    }

    // Markdown/純文字響應（已完成）
    const textResult = await response.text()
    return {
      status: 'completed',
      result: textResult
    }
  } catch (error: any) {
    console.error('Media Status Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '伺服器錯誤',
      data: { status: 'error' },
    })
  }
})
