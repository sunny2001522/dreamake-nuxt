import type { TimedSegment, SubtitleFont, SubtitleBackground } from '~/types'

export interface BurnSubtitlesRequest {
  videoUrl: string
  segments: TimedSegment[]
  font: SubtitleFont
  background: SubtitleBackground
  subtitleY: number
  videoWidth: number
  videoHeight: number
  assContent?: string // Pre-generated ASS content from client
}

const MAX_RETRIES = 2
const RETRY_DELAY = 3000 // 3 seconds

/**
 * Call Render FFmpeg service with automatic retry for cold start handling
 */
async function callRenderWithRetry(
  url: string,
  apiKey: string,
  body: object,
  attempt = 1
): Promise<Response> {
  const response = await fetch(`${url}/burn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
  })

  // If 5xx error and retries remaining, wait and retry (handle cold start)
  if (response.status >= 500 && attempt < MAX_RETRIES) {
    console.log(`Render service error (attempt ${attempt}), retrying in ${RETRY_DELAY}ms...`)
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    return callRenderWithRetry(url, apiKey, body, attempt + 1)
  }

  return response
}

/**
 * POST /api/video/burn-subtitles
 *
 * Proxy to Render FFmpeg service for subtitle burning.
 * Returns the processed video as a binary response.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Check if Render service is configured
  if (!config.renderFfmpegUrl || !config.renderApiKey) {
    console.error('Missing RENDER_FFMPEG_URL or RENDER_API_KEY environment variables')
    throw createError({
      statusCode: 500,
      message: 'FFmpeg service not configured',
    })
  }

  try {
    const body: BurnSubtitlesRequest = await readBody(event)

    // Validate required fields
    if (!body.videoUrl) {
      throw createError({
        statusCode: 400,
        message: 'videoUrl is required',
      })
    }

    console.log('Proxying burn request to Render:', {
      videoUrl: body.videoUrl.substring(0, 50) + '...',
      segmentsCount: body.segments?.length || 0,
      font: body.font,
      background: body.background,
      subtitleY: body.subtitleY,
      videoWidth: body.videoWidth,
      videoHeight: body.videoHeight,
      hasAssContent: !!body.assContent,
    })

    // Forward request to Render FFmpeg service
    const renderResponse = await callRenderWithRetry(
      config.renderFfmpegUrl,
      config.renderApiKey,
      body
    )

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text()
      console.error('Render FFmpeg error:', errorText)
      throw createError({
        statusCode: renderResponse.status,
        message: 'FFmpeg service error',
        data: { details: errorText },
      })
    }

    const videoBuffer = await renderResponse.arrayBuffer()
    console.log('Received video from Render, size:', videoBuffer.byteLength)

    // Return the video as a binary response
    setResponseHeaders(event, {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.byteLength.toString(),
      'Content-Disposition': 'attachment; filename="video-with-subtitles.mp4"',
    })

    return Buffer.from(videoBuffer)
  } catch (error: any) {
    console.error('Burn subtitles proxy error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to burn subtitles',
      data: { details: String(error) },
    })
  }
})
