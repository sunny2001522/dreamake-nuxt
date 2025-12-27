/**
 * Vue composable for subtitle burning via Server-side FFmpeg (Render service)
 * Includes automatic retry logic for cold start handling
 */

import type { TimedSegment, SubtitleFont, SubtitleBackground } from '~/types'
import { generateASS } from '~/utils/ffmpeg/assGenerator'

export interface BurnSubtitleOptions {
  videoUrl: string
  segments: TimedSegment[]
  font: SubtitleFont
  titleBackground: SubtitleBackground // 標題背景（黑底/白底/無底）
  subtitleY: number
  videoWidth: number
  videoHeight: number
  title?: string // 標題文字（可選）
  titleY?: number // 標題位置（可選）
}

// Retry configuration for cold start handling
const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

export function useFFmpeg() {
  const isProcessing = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)
  const retryStatus = ref<string | null>(null)

  async function burnSubtitles(
    options: BurnSubtitleOptions
  ): Promise<Blob | null> {
    isProcessing.value = true
    progress.value = 0
    error.value = null
    retryStatus.value = null

    console.log('Calling server-side FFmpeg for subtitle burning...')
    console.log('Options:', {
      videoUrl: options.videoUrl,
      segmentsCount: options.segments.length,
      font: options.font,
      titleBackground: options.titleBackground,
      subtitleY: options.subtitleY,
      videoWidth: options.videoWidth,
      videoHeight: options.videoHeight,
      title: options.title,
      titleY: options.titleY,
    })

    // Generate ASS content on client side for consistent styling
    const assContent = generateASS({
      segments: options.segments,
      font: options.font,
      titleBackground: options.titleBackground,
      subtitleY: options.subtitleY,
      videoWidth: options.videoWidth,
      videoHeight: options.videoHeight,
      title: options.title,
      titleY: options.titleY,
    })
    console.log('Generated ASS content length:', assContent.length)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Subtitle burn attempt ${attempt}/${MAX_RETRIES}...`)

        const response = await fetch('/api/video/burn-subtitles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...options,
            assContent, // Include pre-generated ASS content
          }),
        })

        if (response.ok) {
          const blob = await response.blob()
          console.log('Server FFmpeg complete, blob size:', blob.size)
          progress.value = 1
          retryStatus.value = null
          isProcessing.value = false
          return blob
        }

        // If 5xx error (possibly cold start), retry
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          console.log(
            `Server error (${response.status}), retrying in ${RETRY_DELAY}ms...`
          )
          retryStatus.value = `服務啟動中，正在重試 (${attempt}/${MAX_RETRIES})...`
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
          continue
        }

        // Non-retryable error or max retries reached
        const errorText = await response.text()
        throw new Error(`Server subtitle burning failed: ${errorText}`)
      } catch (err) {
        // If network error and retries remaining, retry
        if (attempt < MAX_RETRIES && err instanceof TypeError) {
          console.log(`Network error, retrying in ${RETRY_DELAY}ms...`)
          retryStatus.value = `網路錯誤，正在重試 (${attempt}/${MAX_RETRIES})...`
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
          continue
        }

        // Max retries reached or non-retryable error
        const errorMessage =
          err instanceof Error ? err.message : '字幕燒錄失敗'
        error.value = errorMessage
        retryStatus.value = null
        console.error('useFFmpeg burnSubtitles error:', err)
        isProcessing.value = false
        return null
      }
    }

    // Should not reach here, but just in case
    error.value = '字幕燒錄失敗：已達最大重試次數'
    retryStatus.value = null
    isProcessing.value = false
    return null
  }

  // Preload is no-op for server-side processing
  async function preload() {}

  return {
    isSupported: true, // Server-side always supported
    isLoading: false,
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    error: readonly(error),
    retryStatus: readonly(retryStatus),
    burnSubtitles,
    preload,
  }
}
