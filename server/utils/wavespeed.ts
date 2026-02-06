import type { WaveSpeedResolution } from '~/types'

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk'
const WAVESPEED_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions'

export const DEFAULT_WAVESPEED_PROMPT = '對著鏡頭講話，侃侃而談，搭配手部動作，輕鬆而自然'
const DEFAULT_RESOLUTION: WaveSpeedResolution = '720p'
const DEFAULT_SEED = 42

function getApiKey() {
  const config = useRuntimeConfig()
  if (!config.wavespeedApiKey) {
    throw new Error('WAVESPEED_API_KEY not configured')
  }
  return config.wavespeedApiKey
}

/**
 * Start WaveSpeed InfiniteTalk video generation
 * @param params Generation parameters
 * @returns Request ID for polling
 */
export async function generateWaveSpeedVideo(params: {
  audioUrl: string
  imageUrl: string
  prompt?: string
  resolution?: WaveSpeedResolution
  seed?: number
}): Promise<{ requestId: string }> {
  const {
    audioUrl,
    imageUrl,
    prompt = DEFAULT_WAVESPEED_PROMPT,
    resolution = DEFAULT_RESOLUTION,
    seed = DEFAULT_SEED,
  } = params

  const apiKey = getApiKey()

  console.log('Calling WaveSpeed InfiniteTalk API:', {
    audioUrl,
    imageUrl,
    prompt,
    resolution,
    seed,
  })

  const response = await fetch(WAVESPEED_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      audio: audioUrl,
      image: imageUrl,
      prompt,
      resolution,
      seed,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('WaveSpeed API Error Response:')
    console.error('Status:', response.status)
    console.error('Body:', errorText)
    throw new Error(`WaveSpeed API request failed with status ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log('WaveSpeed API response:', data)

  const requestId = data.data?.id || data.id
  if (!requestId) {
    throw new Error('WaveSpeed API did not return a request ID')
  }

  return { requestId }
}

/**
 * Get WaveSpeed video generation status
 * @param requestId The request ID from generateWaveSpeedVideo
 * @returns Status and video URL if completed
 */
export async function getWaveSpeedVideoStatus(requestId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  executionTime?: number
  error?: string
}> {
  const apiKey = getApiKey()

  console.log('Checking WaveSpeed video status for requestId:', requestId)

  const response = await fetch(`${WAVESPEED_RESULT_URL}/${requestId}/result`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('WaveSpeed Result API Error:', errorText)
    throw new Error(`WaveSpeed Result API failed with status ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log('WaveSpeed result response:', JSON.stringify(data, null, 2))

  // Extract status from response
  const rawStatus = data.data?.status || data.status || 'processing'
  const outputs = data.data?.outputs || data.outputs || []
  const videoUrl = Array.isArray(outputs) ? outputs[0] : outputs?.video || null
  const errorMsg = data.data?.error || data.error || null
  const executionTime = data.data?.executionTime || data.executionTime || 0
  const createdAt = data.data?.created_at || data.created_at

  // Map WaveSpeed status to our status
  let status: 'pending' | 'processing' | 'completed' | 'failed'

  if (rawStatus === 'completed' || rawStatus === 'succeeded') {
    status = 'completed'
  } else if (rawStatus === 'failed' || rawStatus === 'error') {
    status = 'failed'
  } else if (rawStatus === 'processing' || rawStatus === 'running') {
    // Check for stale tasks: if processing for more than 10 minutes, treat as failed
    const MAX_PROCESSING_MS = 10 * 60 * 1000
    if (createdAt) {
      const ageMs = Date.now() - new Date(createdAt).getTime()
      if (ageMs > MAX_PROCESSING_MS) {
        console.warn(`WaveSpeed task ${requestId} has been processing for ${Math.round(ageMs / 1000)}s, marking as failed`)
        status = 'failed'
      } else {
        status = 'processing'
      }
    } else {
      status = 'processing'
    }
  } else {
    // pending, created, queued, etc.
    status = 'pending'
  }

  // Provide error message for stale tasks
  const staleError = (status === 'failed' && !errorMsg && createdAt)
    ? '影片生成逾時，請重新生成'
    : null

  return {
    status,
    videoUrl: status === 'completed' ? videoUrl : undefined,
    executionTime,
    error: errorMsg || staleError,
  }
}
