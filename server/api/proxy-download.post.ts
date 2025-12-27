export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body

  if (!url) {
    throw createError({ statusCode: 400, message: 'URL is required' })
  }

  // 驗證 URL 格式
  try {
    new URL(url)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL format' })
  }

  try {
    // 從遠端獲取檔案
    const response = await fetch(url)

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: `Failed to fetch file: ${response.statusText}`,
      })
    }

    // 設定正確的 Content-Type
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    setHeader(event, 'Content-Type', contentType)

    // 設定 Content-Length 以支援下載進度顯示
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      setHeader(event, 'Content-Length', contentLength)
    }

    // 設定 Content-Disposition 讓瀏覽器下載
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      setHeader(event, 'Content-Disposition', contentDisposition)
    }

    // 取得檔案內容並回傳
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  } catch (error: any) {
    console.error('Proxy download error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to download file',
    })
  }
})
