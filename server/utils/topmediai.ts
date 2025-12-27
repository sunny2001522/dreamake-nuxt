import { fixPronunciation } from './pronunciationFix'

const TOPMEDIAI_BASE_URL = 'https://api.topmediai.com/v1'

interface TextToSpeechResponse {
  code?: number
  message?: string
  status?: string
  error?: string
  data?: {
    audio_url?: string
    oss_url?: string
  }
  audio_url?: string
  oss_url?: string
}

/**
 * Generate speech from text using TopMediai TTS
 */
export async function textToSpeech(
  transcript: string,
  speakerId: string
): Promise<{ audioUrl: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    throw new Error('TopMediai API key not configured')
  }

  if (!speakerId) {
    throw new Error('speakerId is required for textToSpeech')
  }

  if (!transcript) {
    throw new Error('transcript is required for textToSpeech')
  }

  // Apply pronunciation fix for Taiwan accent
  const ttsText = fixPronunciation(transcript.substring(0, 500))

  // Debug logging
  console.log('=== TOPMEDIAI TTS Debug ===')
  console.log('API Key (first 8 chars):', apiKey?.substring(0, 8) + '...')
  console.log('Speaker ID:', speakerId)
  console.log('Text length:', ttsText.length)
  console.log('Text (first 100 chars):', ttsText.substring(0, 100))

  const ttsResponse = await fetch(`${TOPMEDIAI_BASE_URL}/text2speech`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: ttsText,
      speaker: speakerId,
      emotion: 'Neutral',
    }),
  })

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text()
    console.error('TOPMEDIAI TTS failed:', errorText)

    // Check if speaker not found (voice might have expired)
    if (errorText.includes('speaker') || errorText.includes('not found')) {
      throw new Error(`Speaker not found - the saved voice may have expired: ${errorText}`)
    }

    throw new Error(`Failed to generate speech from TOPMEDIAI: ${errorText}`)
  }

  const ttsResult: TextToSpeechResponse = await ttsResponse.json()

  // Debug: Log the raw response
  console.log('TOPMEDIAI TTS raw response:', JSON.stringify(ttsResult, null, 2))
  console.log('=== End TOPMEDIAI Debug ===')

  // Check for API-level errors (some APIs return 200 with error in body)
  if (ttsResult.code && ttsResult.code !== 0) {
    throw new Error(`TopMediai API error (code ${ttsResult.code}): ${ttsResult.message || 'Unknown error'}`)
  }
  if (ttsResult.error) {
    throw new Error(`TopMediai API error: ${ttsResult.error}`)
  }

  // Extract audio URL from response (handle different response structures)
  const audioUrl = ttsResult.data?.audio_url ||
                   ttsResult.data?.oss_url ||
                   ttsResult.audio_url ||
                   ttsResult.oss_url

  if (!audioUrl) {
    throw new Error(`TOPMEDIAI TTS response did not contain an audio URL. Full response: ${JSON.stringify(ttsResult)}`)
  }

  console.log('TOPMEDIAI TTS generated successfully, audio URL:', audioUrl)

  return { audioUrl }
}

/**
 * Clone a voice from audio files
 */
export async function cloneVoice(
  audioFiles: { data: ArrayBuffer; filename: string; type: string }[],
  voiceName: string
): Promise<{ speakerId: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    throw new Error('TopMediai API key not configured')
  }

  const formData = new FormData()
  formData.append('name', voiceName)

  // Add all audio files
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i]
    const blob = new Blob([file.data], { type: file.type })
    formData.append('audio', blob, file.filename)
  }

  console.log(`TOPMEDIAI Clone - Starting clone with ${audioFiles.length} audio files`)

  const response = await fetch(`${TOPMEDIAI_BASE_URL}/clone?model=HD`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('TOPMEDIAI Clone failed:', errorText)

    // Check for permission/subscription issues
    if (errorText.includes('permission') || errorText.includes('subscription')) {
      throw new Error('TopMediai API 帳戶沒有語音克隆權限，請檢查訂閱狀態')
    }

    throw new Error(`Failed to clone voice: ${errorText}`)
  }

  const result = await response.json()
  console.log('TOPMEDIAI Clone result:', result)

  const speakerId = result.data?.speaker_id || result.speaker_id
  if (!speakerId) {
    throw new Error('TOPMEDIAI Clone response did not contain a speaker ID')
  }

  return { speakerId }
}

/**
 * Get list of cloned voices
 */
export async function getClonedVoices(name?: string): Promise<any> {
  const config = useRuntimeConfig()
  const apiKey = config.topMediaiApiKey

  if (!apiKey) {
    throw new Error('TopMediai API key not configured')
  }

  const url = new URL(`${TOPMEDIAI_BASE_URL}/clone_voices_list`)
  if (name) {
    url.searchParams.set('name', name)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get cloned voices: ${errorText}`)
  }

  return await response.json()
}
