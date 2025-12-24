/**
 * OpenAI Whisper API integration for speech-to-text with word-level timestamps.
 * Used for accurate subtitle timing in DreaMake.
 */

import type { TimedSegment } from '~/types'

/**
 * Word-level timing from Whisper API
 */
export interface WhisperWord {
  word: string
  start: number  // seconds
  end: number    // seconds
}

/**
 * Segment-level timing from Whisper API
 */
export interface WhisperSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

/**
 * Full Whisper API response with verbose_json format
 */
export interface WhisperResponse {
  task: string
  language: string
  duration: number
  text: string
  words?: WhisperWord[]
  segments?: WhisperSegment[]
}

function getApiKey() {
  const config = useRuntimeConfig()
  return config.openaiApiKey
}

/**
 * Transcribe audio using OpenAI Whisper API with word-level timestamps.
 *
 * @param audioBuffer - Audio data as Buffer
 * @param filename - Filename for the audio (helps Whisper detect format)
 * @param language - Language code (default: 'zh' for Chinese)
 * @returns WhisperResponse with words array containing precise timestamps
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.mp3',
  language: string = 'zh'
): Promise<WhisperResponse> {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // Determine MIME type from filename
  const mimeType = getMimeType(filename)

  // Create FormData for multipart upload
  const formData = new FormData()
  const blob = new Blob([audioBuffer], { type: mimeType })
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-1') // Must use whisper-1 for word timestamps
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')
  formData.append('timestamp_granularities[]', 'segment')
  formData.append('language', language)

  console.log(`Calling Whisper API: file=${filename}, language=${language}`)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Whisper API error: ${response.status} ${response.statusText}`
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `Whisper API error: ${errorJson.error?.message || errorText}`
    } catch {
      errorMessage = `Whisper API error: ${errorText}`
    }
    throw new Error(errorMessage)
  }

  const result: WhisperResponse = await response.json()
  console.log(`Whisper transcription complete: ${result.words?.length || 0} words, duration=${result.duration}s`)

  return result
}

/**
 * Group Whisper words into subtitle segments.
 * Follows DreaMake's subtitle rules:
 * - 6-10 Chinese characters per segment
 * - Break at natural pauses
 * - Keep particles (的、了、著) with preceding words
 * - Keep sentence-final particles (嗎、呢、吧、啊、喔、耶、啦、囉) with preceding sentence
 * - Remove all punctuation
 *
 * @param words - Word-level timestamps from Whisper
 * @param minChars - Minimum characters per segment (default: 6)
 * @param maxChars - Maximum characters per segment (default: 10)
 * @returns Array of TimedSegment with accurate timestamps
 */
export function groupWordsToSegments(
  words: WhisperWord[],
  minChars: number = 6,
  maxChars: number = 10
): TimedSegment[] {
  if (!words || words.length === 0) {
    return []
  }

  const segments: TimedSegment[] = []
  let currentText = ''
  let currentStart = 0
  let currentEnd = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const wordText = cleanWord(word.word)

    if (!wordText) continue // Skip empty words (punctuation only)

    // Start new segment
    if (currentText === '') {
      currentStart = word.start
    }

    currentText += wordText
    currentEnd = word.end

    // Check if we should end the segment
    const nextWord = words[i + 1]
    const charCount = getChineseCharCount(currentText)

    const shouldEndSegment =
      charCount >= minChars && (
        charCount >= maxChars ||
        isNaturalBreakPoint(wordText, nextWord?.word) ||
        hasLongPause(word, nextWord)
      )

    if (shouldEndSegment) {
      segments.push({
        text: currentText,
        startTime: currentStart,
        endTime: currentEnd
      })
      currentText = ''
    }
  }

  // Handle remaining text
  if (currentText.length > 0) {
    segments.push({
      text: currentText,
      startTime: currentStart,
      endTime: currentEnd
    })
  }

  return segments
}

/**
 * Clean word text by removing punctuation
 */
function cleanWord(word: string): string {
  return word
    .trim()
    .replace(/[，。！？、；：,\.!?\-—\[\]【】「」『』：""'']/g, '')
}

/**
 * Count Chinese characters (excluding ASCII)
 */
function getChineseCharCount(text: string): number {
  // Count all non-ASCII characters as Chinese
  let count = 0
  for (const char of text) {
    if (char.charCodeAt(0) > 127) {
      count++
    } else {
      // Count ASCII characters as 0.5 (two ASCII ≈ one Chinese character width)
      count += 0.5
    }
  }
  return Math.ceil(count)
}

/**
 * Check if this is a natural break point for subtitles.
 * Don't break before particles or sentence-final particles.
 */
function isNaturalBreakPoint(currentWord: string, nextWord?: string): boolean {
  // End of sentence punctuation
  if (/[。！？]$/.test(currentWord)) return true

  // Don't break if next word is a particle
  if (nextWord) {
    const particles = ['的', '了', '著', '過']
    const sentenceFinalParticles = ['嗎', '呢', '吧', '啊', '喔', '耶', '啦', '囉', '哦', '噢', '欸']

    const nextClean = cleanWord(nextWord)
    if (particles.includes(nextClean) || sentenceFinalParticles.includes(nextClean)) {
      return false
    }
  }

  // Comma or semicolon is a reasonable break point
  if (/[，、；]$/.test(currentWord)) return true

  return false
}

/**
 * Check if there's a long pause between words (indicating natural break)
 */
function hasLongPause(current: WhisperWord, next?: WhisperWord): boolean {
  if (!next) return true // End of audio

  const gap = next.start - current.end
  return gap > 0.3 // 300ms pause suggests natural break
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'ogg': 'audio/ogg',
    'mpeg': 'audio/mpeg',
    'mpga': 'audio/mpeg',
  }
  return mimeTypes[ext || ''] || 'audio/mpeg'
}

/**
 * Check if Whisper API is available (has API key configured)
 */
export function isWhisperAvailable(): boolean {
  const config = useRuntimeConfig()
  return !!config.openaiApiKey
}

/**
 * Align original transcript with Whisper timing information.
 * Uses Whisper's accurate timestamps but preserves the original text (avoids Traditional/Simplified conversion).
 * PRIORITY: Split by punctuation first, then by character count if needed.
 *
 * @param originalTranscript - The original transcript text (Traditional Chinese)
 * @param whisperWords - Word-level timestamps from Whisper
 * @returns Array of TimedSegment with original text and Whisper timestamps
 */
export function alignTranscriptWithWhisperTimings(
  originalTranscript: string,
  whisperWords: WhisperWord[]
): TimedSegment[] {
  if (!whisperWords || whisperWords.length === 0) {
    return []
  }

  // Step 1: Split by punctuation first (priority over character count)
  const punctuationPattern = /[，。！？、；：,\.!?\n]+/g
  const rawSegments = originalTranscript
    .split(punctuationPattern)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // Step 2: Further split segments that are too long (>15 chars)
  const textSegments: string[] = []
  const maxChars = 15

  for (const segment of rawSegments) {
    if (getChineseCharCount(segment) <= maxChars) {
      textSegments.push(segment)
    } else {
      // Split long segments at natural break points
      const subSegments = splitLongSegment(segment, maxChars)
      textSegments.push(...subSegments)
    }
  }

  // Step 3: Build character-to-time mapping from Whisper
  const whisperTimeline: { time: number; endTime: number }[] = []

  for (const word of whisperWords) {
    const cleanedWord = word.word.replace(/[，。！？、；：,\.!?\-—\[\]【】「」『』：""''\s]/g, '')
    if (cleanedWord.length === 0) continue

    const charDuration = (word.end - word.start) / cleanedWord.length
    for (let i = 0; i < cleanedWord.length; i++) {
      whisperTimeline.push({
        time: word.start + i * charDuration,
        endTime: word.start + (i + 1) * charDuration
      })
    }
  }

  if (whisperTimeline.length === 0) {
    return []
  }

  const lastWordEnd = whisperWords[whisperWords.length - 1].end
  const cleanedTranscript = originalTranscript
    .replace(/[，。！？、；：,\.!?\-—\[\]【】「」『』：""''\s\n]/g, '')
  const totalCleanedChars = cleanedTranscript.length

  // Step 4: Assign timestamps to each text segment
  const segments: TimedSegment[] = []
  let charOffset = 0

  for (const text of textSegments) {
    const segmentCharCount = text.length

    // Map start position to Whisper timeline
    const startIdx = Math.min(
      Math.floor((charOffset / totalCleanedChars) * whisperTimeline.length),
      whisperTimeline.length - 1
    )

    // Map end position to Whisper timeline
    const endCharOffset = charOffset + segmentCharCount
    const endIdx = Math.min(
      Math.floor((endCharOffset / totalCleanedChars) * whisperTimeline.length),
      whisperTimeline.length - 1
    )

    const startTime = whisperTimeline[startIdx].time
    const endTime = endIdx < whisperTimeline.length - 1
      ? whisperTimeline[endIdx].endTime
      : lastWordEnd

    segments.push({
      text,
      startTime,
      endTime
    })

    charOffset = endCharOffset
  }

  return segments
}

/**
 * Split a long segment into smaller chunks at natural break points.
 */
function splitLongSegment(text: string, maxChars: number): string[] {
  const results: string[] = []
  let current = ''

  for (const char of text) {
    current += char

    const charCount = getChineseCharCount(current)
    if (charCount >= maxChars) {
      results.push(current)
      current = ''
    }
  }

  // Handle remaining text
  if (current.length > 0) {
    // If too short, merge with previous segment
    if (results.length > 0 && getChineseCharCount(current) < 3) {
      results[results.length - 1] += current
    } else {
      results.push(current)
    }
  }

  return results
}
