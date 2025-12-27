/**
 * Vue composable for subtitle synchronization and generation
 * Handles real-time subtitle display during video playback
 */

import type { TimedSegment } from '~/types'

export function useSubtitleSync() {
  const subtitleSegments = ref<TimedSegment[]>([])
  const hasTimestamps = ref(false)
  const isLoadingSubtitles = ref(false)
  const error = ref<string | null>(null)

  /**
   * Get current subtitle segment based on playback progress
   * Uses pre-generated segments from Whisper/Gemini AI
   */
  function getCurrentSegment(currentTime: number, duration: number): string {
    if (subtitleSegments.value.length === 0 || duration === 0) return ''

    // If we have timestamps from audio analysis, use them for accurate sync
    if (hasTimestamps.value) {
      const segment = subtitleSegments.value.find(
        (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
      )
      return segment?.text || ''
    }

    // Fallback: distribute segments evenly across duration
    const progress = currentTime / duration
    const segmentIndex = Math.floor(progress * subtitleSegments.value.length)
    const segment =
      subtitleSegments.value[
        Math.min(segmentIndex, subtitleSegments.value.length - 1)
      ]

    return segment?.text || ''
  }

  /**
   * Generate subtitle segments from audio URL and transcript
   * Calls the subtitle API to get timed segments
   */
  async function generateSegments(
    audioUrl: string,
    transcript: string
  ): Promise<void> {
    if (!transcript.trim()) return

    isLoadingSubtitles.value = true
    error.value = null

    try {
      // Fetch audio as blob for API
      const audioResponse = await fetch(audioUrl)
      const audioBlob = await audioResponse.blob()

      // Create form data
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.mp3')
      formData.append('transcript', transcript)

      // Call subtitle generation API
      const response = await $fetch('/api/subtitle', {
        method: 'POST',
        body: formData,
      })

      const result = response as {
        segments: TimedSegment[]
        hasTimestamps: boolean
        source: string
      }

      subtitleSegments.value = result.segments
      hasTimestamps.value = result.hasTimestamps

      console.log('Subtitle segments generated:', {
        count: result.segments.length,
        hasTimestamps: result.hasTimestamps,
        source: result.source,
      })
    } catch (err) {
      console.error('Failed to generate subtitle segments:', err)
      error.value =
        err instanceof Error ? err.message : 'Failed to generate subtitles'

      // Fallback: simple text segmentation
      subtitleSegments.value = simpleTextSegmentation(transcript)
      hasTimestamps.value = false
    } finally {
      isLoadingSubtitles.value = false
    }
  }

  /**
   * Generate segments from transcript only (no audio)
   * Uses simple text-based segmentation
   */
  async function generateSegmentsFromText(transcript: string): Promise<void> {
    if (!transcript.trim()) return

    isLoadingSubtitles.value = true
    error.value = null

    try {
      // Call subtitle API with transcript only
      const response = await $fetch('/api/subtitle', {
        method: 'POST',
        body: { transcript },
      })

      const result = response as {
        segments: TimedSegment[]
        hasTimestamps: boolean
        source: string
      }

      subtitleSegments.value = result.segments
      hasTimestamps.value = result.hasTimestamps

      console.log('Text-only subtitle segments generated:', {
        count: result.segments.length,
        source: result.source,
      })
    } catch (err) {
      console.error('Failed to generate subtitle segments from text:', err)
      error.value =
        err instanceof Error ? err.message : 'Failed to generate subtitles'

      // Fallback: simple text segmentation
      subtitleSegments.value = simpleTextSegmentation(transcript)
      hasTimestamps.value = false
    } finally {
      isLoadingSubtitles.value = false
    }
  }

  /**
   * Set segments directly (e.g., from history item)
   */
  function setSegments(
    segments: TimedSegment[],
    withTimestamps: boolean = false
  ) {
    subtitleSegments.value = segments
    hasTimestamps.value = withTimestamps
  }

  /**
   * Clear all segments
   */
  function clearSegments() {
    subtitleSegments.value = []
    hasTimestamps.value = false
    error.value = null
  }

  return {
    subtitleSegments: readonly(subtitleSegments),
    hasTimestamps: readonly(hasTimestamps),
    isLoadingSubtitles: readonly(isLoadingSubtitles),
    error: readonly(error),
    getCurrentSegment,
    generateSegments,
    generateSegmentsFromText,
    setSegments,
    clearSegments,
  }
}

/**
 * Simple text segmentation fallback
 * Splits transcript into 6-10 character chunks
 */
function simpleTextSegmentation(transcript: string): TimedSegment[] {
  // Remove punctuation and extra spaces
  const cleanText = transcript
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, '')
    .trim()

  if (!cleanText) return []

  const segments: TimedSegment[] = []
  const minChars = 6
  const maxChars = 10

  let i = 0
  while (i < cleanText.length) {
    // Get segment of 6-10 characters
    const remainingChars = cleanText.length - i
    let segmentLength = Math.min(maxChars, remainingChars)

    // If remaining is less than minChars, just take it all
    if (remainingChars <= maxChars) {
      segmentLength = remainingChars
    } else if (remainingChars - maxChars < minChars) {
      // Avoid leaving a tiny segment at the end
      segmentLength = Math.ceil(remainingChars / 2)
    }

    const text = cleanText.slice(i, i + segmentLength)
    segments.push({
      text,
      startTime: -1, // No timestamps
      endTime: -1,
    })

    i += segmentLength
  }

  return segments
}
