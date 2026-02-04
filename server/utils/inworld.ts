/**
 * Inworld AI TTS/Voice Cloning Integration
 *
 * API Documentation:
 * - TTS: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech
 * - Clone: https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/clone-voice
 */

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice'
const INWORLD_CLONE_BASE_URL = 'https://api.inworld.ai/voices/v1/workspaces'

interface TextToSpeechResponse {
  audioContent: string // base64 encoded audio
  timestampInfo?: {
    wordAlignment?: {
      words: string[]
      wordStartTimeSeconds: number[]
      wordEndTimeSeconds: number[]
    }
  }
}

interface CloneVoiceResponse {
  voice: {
    langCode: string
    displayName: string
    name: string
    description?: string
    tags?: string[]
    voiceId: string
  }
  audioSamplesValidated?: Array<{
    langCode: string
    warnings?: Array<{ text: string }>
    errors?: Array<{ text: string }>
    transcription?: string
    audioData?: string
  }>
}

/**
 * Generate speech from text using Inworld TTS
 */
export async function textToSpeech(
  transcript: string,
  voiceId: string
): Promise<{ audioUrl: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.inworldApiKey

  if (!apiKey) {
    throw new Error('Inworld API key not configured')
  }

  if (!voiceId) {
    throw new Error('voiceId is required for textToSpeech')
  }

  if (!transcript) {
    throw new Error('transcript is required for textToSpeech')
  }

  // Limit text to 2000 characters (Inworld limit)
  const ttsText = transcript.substring(0, 2000)

  console.log('=== INWORLD TTS Debug ===')
  console.log('Voice ID:', voiceId)
  console.log('Text length:', ttsText.length)
  console.log('Text (first 100 chars):', ttsText.substring(0, 100))

  const response = await fetch(INWORLD_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: ttsText,
      voiceId: voiceId,
      modelId: 'inworld-tts-1',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('INWORLD TTS failed:', errorText)

    if (errorText.includes('voice') || errorText.includes('not found')) {
      throw new Error(`Voice not found - the saved voice may have expired: ${errorText}`)
    }

    throw new Error(`Failed to generate speech from Inworld: ${errorText}`)
  }

  const result: TextToSpeechResponse = await response.json()
  console.log('INWORLD TTS response received, audioContent length:', result.audioContent?.length || 0)
  console.log('=== End INWORLD Debug ===')

  if (!result.audioContent) {
    throw new Error('Inworld TTS response did not contain audioContent')
  }

  // Convert base64 to data URL (audio/wav format)
  const audioUrl = `data:audio/wav;base64,${result.audioContent}`

  return { audioUrl }
}

/**
 * Clone a voice from audio files using Inworld
 *
 * Note: Inworld accepts up to 3 samples, each 5-15 seconds
 * Audio data must be base64 encoded
 */
export async function cloneVoice(
  audioFiles: { data: ArrayBuffer; filename: string; type: string }[],
  voiceName: string
): Promise<{ speakerId: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.inworldApiKey
  const workspaceId = config.inworldWorkspaceId

  if (!apiKey) {
    throw new Error('Inworld API key not configured')
  }

  if (!workspaceId) {
    throw new Error('Inworld workspace ID not configured')
  }

  // Inworld accepts up to 3 samples
  const samplesToUse = audioFiles.slice(0, 3)

  console.log(`INWORLD Clone - Starting clone with ${samplesToUse.length} audio samples`)

  // Convert audio files to base64 encoded samples
  const voiceSamples = samplesToUse.map((file) => {
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(file.data)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64Audio = btoa(binary)

    return {
      audioData: base64Audio,
      // transcription is optional, can be omitted
    }
  })

  const cloneUrl = `${INWORLD_CLONE_BASE_URL}/${workspaceId}/voices:clone`

  // Inworld derives internal "name" from displayName, requiring only
  // lowercase letters, digits, underscores, hyphens (max 61 chars).
  // Sanitize displayName to ensure the derived name is valid.
  const safeDisplayName = voiceName
    .replace(/[^a-zA-Z0-9_\s-]/g, '')
    .trim()
    .slice(0, 60) || `voice_${Date.now()}`

  const response = await fetch(cloneUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      displayName: safeDisplayName,
      langCode: 'ZH_CN', // Standard Mandarin (no ZH_TW available, AUTO detects as dialect)
      voiceSamples: voiceSamples,
      audioProcessingConfig: {
        removeBackgroundNoise: true,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('INWORLD Clone failed:', errorText)

    if (errorText.includes('permission') || errorText.includes('subscription') || errorText.includes('unauthorized')) {
      throw new Error('Inworld API 帳戶沒有語音克隆權限，請檢查 API key 設定')
    }

    if (errorText.includes('workspace')) {
      throw new Error('Inworld Workspace ID 設定錯誤，請確認 INWORLD_WORKSPACE_ID 環境變數')
    }

    throw new Error(`Failed to clone voice: ${errorText}`)
  }

  const result: CloneVoiceResponse = await response.json()
  console.log('INWORLD Clone result:', result)

  // Check for validation errors
  if (result.audioSamplesValidated) {
    for (const sample of result.audioSamplesValidated) {
      if (sample.errors && sample.errors.length > 0) {
        const errorMessages = sample.errors.map(e => e.text).join(', ')
        console.error('INWORLD Clone sample validation errors:', errorMessages)
        throw new Error(`音檔驗證失敗: ${errorMessages}`)
      }
      if (sample.warnings && sample.warnings.length > 0) {
        console.warn('INWORLD Clone sample warnings:', sample.warnings.map(w => w.text).join(', '))
      }
    }
  }

  const voiceId = result.voice?.voiceId
  if (!voiceId) {
    throw new Error('Inworld Clone response did not contain a voiceId')
  }

  console.log('INWORLD Clone successful, voiceId:', voiceId)

  // Return voiceId as speakerId for compatibility with existing database schema
  return { speakerId: voiceId }
}

/**
 * List available voices (cloned + built-in)
 */
export async function listVoices(): Promise<any> {
  const config = useRuntimeConfig()
  const apiKey = config.inworldApiKey

  if (!apiKey) {
    throw new Error('Inworld API key not configured')
  }

  // Note: The list voices endpoint may require different URL/auth
  // For now, returning empty as cloned voices are stored in our database
  console.log('INWORLD listVoices - not implemented, using database for voice list')
  return { voices: [] }
}
