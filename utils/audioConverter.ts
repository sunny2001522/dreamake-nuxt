/**
 * Audio format converter utilities
 * Converts browser-recorded WebM audio to WAV format for API compatibility
 *
 * Inworld AI supports: WAV, MP3, Linear PCM
 * (Previously: TopMediai supports: WAV, MP3, AAC, FLAC, AIFF, Opus, OGG, OGA, M4A)
 */

/**
 * Check if file is in WebM format (by MIME type or extension)
 */
export function isWebmAudio(file: File): boolean {
  return (
    file.type === 'audio/webm' ||
    file.type === 'audio/webm;codecs=opus' ||
    file.name.toLowerCase().endsWith('.webm')
  )
}

/**
 * Convert audio file to compressed WAV format (16000Hz mono)
 * Uses lower sample rate to reduce file size significantly
 *
 * @param file - Input audio file (any format supported by browser)
 * @returns Compressed WAV file
 */
export async function convertToWav(file: File): Promise<File> {
  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  try {
    // Decode audio data
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Convert to compressed WAV (16000Hz mono)
    const wavBlob = audioBufferToCompressedWav(audioBuffer)

    // Create new file with .wav extension
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const wavFile = new File([wavBlob], `${baseName}.wav`, {
      type: 'audio/wav',
    })

    console.log('Audio converted to WAV:', {
      original: { name: file.name, type: file.type, size: file.size },
      converted: { name: wavFile.name, type: wavFile.type, size: wavFile.size },
      compressionRatio: (file.size / wavFile.size).toFixed(2) + 'x',
    })

    return wavFile
  } finally {
    await audioContext.close()
  }
}

/**
 * Convert AudioBuffer to WAV Blob (highly compressed: 16000Hz, mono, 16-bit, with normalization)
 * Optimized for deployment environment with ~4.5MB limit
 * 16kHz is sufficient for voice cloning (telephone quality)
 * Audio is truncated to MAX_DURATION_SECONDS to ensure file size stays under 10MB
 */
function audioBufferToCompressedWav(audioBuffer: AudioBuffer): Blob {
  const MAX_DURATION_SECONDS = 40 // Maximum duration for voice cloning
  const targetSampleRate = 16000 // Highly compressed (telephone quality, sufficient for voice cloning)
  const format = 1 // PCM
  const bitDepth = 16
  const numChannels = 1 // Force mono

  // Calculate sample count after resampling
  const ratio = audioBuffer.sampleRate / targetSampleRate
  let newLength = Math.floor(audioBuffer.length / ratio)

  // Truncate to maximum duration (40 seconds)
  const maxSamples = MAX_DURATION_SECONDS * targetSampleRate
  if (newLength > maxSamples) {
    console.log(`Audio truncated from ${(newLength / targetSampleRate).toFixed(1)}s to ${MAX_DURATION_SECONDS}s`)
    newLength = maxSamples
  }

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = newLength * blockAlign
  const bufferLength = 44 + dataLength

  const buffer = new ArrayBuffer(bufferLength)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, targetSampleRate, true)
  view.setUint32(28, targetSampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Mix channels to mono
  const inputChannels = audioBuffer.numberOfChannels
  const channels: Float32Array[] = []
  for (let i = 0; i < inputChannels; i++) {
    channels.push(audioBuffer.getChannelData(i))
  }

  // First pass: find maximum amplitude for normalization
  let maxAmplitude = 0
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio)
    let sample = 0
    for (let ch = 0; ch < inputChannels; ch++) {
      sample += channels[ch][srcIndex] || 0
    }
    sample /= inputChannels
    maxAmplitude = Math.max(maxAmplitude, Math.abs(sample))
  }

  // Calculate normalization gain (target peak at 0.95 to avoid clipping)
  const targetPeak = 0.95
  const normalizeGain = maxAmplitude > 0.01 ? targetPeak / maxAmplitude : 10
  const actualGain = Math.min(normalizeGain, 10) // Limit max gain to 10x

  console.log('Audio normalization:', {
    maxAmplitude: maxAmplitude.toFixed(4),
    normalizeGain: actualGain.toFixed(2),
  })

  // Second pass: write normalized audio data
  let offset = 44
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio)
    // Mix all channels to mono
    let sample = 0
    for (let ch = 0; ch < inputChannels; ch++) {
      sample += channels[ch][srcIndex] || 0
    }
    sample /= inputChannels

    // Apply normalization gain
    sample *= actualGain

    // Clamp and convert to 16-bit
    sample = Math.max(-1, Math.min(1, sample))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Convert audio file to a format supported by TTS API (Inworld)
 * Converts all formats to compressed WAV for consistent file size
 *
 * @param file - Input audio file
 * @returns Converted file (compressed WAV)
 */
export async function ensureCompatibleFormat(file: File): Promise<File> {
  console.log('Converting audio to compressed WAV for API compatibility...')

  // Method 1: Direct AudioContext decode
  try {
    return await convertToWav(file)
  } catch (error) {
    console.warn('Direct WAV conversion failed, trying alternative method:', error)
  }

  // Method 2: Use Audio element + OfflineAudioContext
  try {
    const audioUrl = URL.createObjectURL(file)
    const audio = new Audio(audioUrl)

    // Wait for audio to load
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve()
      audio.onerror = () => reject(new Error('Failed to load audio'))
      setTimeout(() => reject(new Error('Audio load timeout')), 10000)
    })

    const duration = audio.duration
    const sampleRate = 44100

    // Create offline context to decode
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate)

    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)

    URL.revokeObjectURL(audioUrl)

    const wavBlob = audioBufferToCompressedWav(audioBuffer)
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const wavFile = new File([wavBlob], `${baseName}.wav`, {
      type: 'audio/wav',
    })

    console.log('Audio converted to WAV (alternative method):', {
      original: { name: file.name, type: file.type, size: file.size },
      converted: { name: wavFile.name, type: wavFile.type, size: wavFile.size },
    })

    return wavFile
  } catch (altError) {
    console.error('All WAV conversion methods failed:', altError)
    // Return original file - API will likely reject it, but at least we tried
    throw new Error('無法轉換音檔格式。請嘗試上傳 MP3 或 WAV 格式的音檔。')
  }
}

/**
 * Get the duration of an audio or video file in seconds
 * Uses HTMLMediaElement for accurate duration detection
 *
 * @param file - Audio or video file
 * @returns Duration in seconds
 */
export async function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const media = file.type.startsWith('video/')
      ? document.createElement('video')
      : document.createElement('audio')

    media.preload = 'metadata'

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('讀取檔案超時'))
    }, 10000)

    media.onloadedmetadata = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(media.duration)
    }

    media.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取檔案'))
    }

    media.src = url
  })
}
