/**
 * Segmented Video Generation Utilities
 * 分段生成影片的核心處理邏輯
 */

import { textToSpeech } from '~/server/utils/inworld'
import { generateWaveSpeedVideo, DEFAULT_WAVESPEED_PROMPT } from '~/server/utils/wavespeed'
import { transcribeAudio, alignTranscriptWithWhisperTimings } from '~/server/utils/whisper'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { STORAGE_BUCKET } from '~/server/utils/supabase'
import type {
  TranscriptSegment,
  GeneratedSegment,
  SegmentStatus,
  TimedSegment,
  WaveSpeedResolution,
} from '~/types'

export interface ProcessSegmentOptions {
  speakerId: string
  avatarUrl: string // 已裁切的頭像 URL
  waveSpeedPrompt?: string
  waveSpeedResolution?: WaveSpeedResolution
}

export interface ProcessSegmentResult {
  segment: GeneratedSegment
  audioBuffer?: Buffer // 保留 buffer 以備重新生成影片時使用
}

/**
 * 上傳暫存檔案到 Supabase Storage 並取得公開 URL
 */
export async function uploadTempBuffer(
  buffer: Buffer,
  filePath: string,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload temp file (${contentType}): ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * 處理單一分段：TTS → Whisper → WaveSpeed
 */
export async function processOneSegment(
  segment: TranscriptSegment,
  options: ProcessSegmentOptions,
  onStatusChange?: (status: SegmentStatus) => void
): Promise<ProcessSegmentResult> {
  const { speakerId, avatarUrl, waveSpeedPrompt, waveSpeedResolution } = options

  const result: GeneratedSegment = {
    id: segment.id,
    index: segment.index,
    text: segment.text,
    status: 'pending',
  }

  try {
    // Step 1: TTS 生成音頻
    result.status = 'tts'
    onStatusChange?.('tts')
    console.log(`[Segment ${segment.index}] Starting TTS...`)

    const { audioUrl: ttsAudioDataUri } = await textToSpeech(segment.text, speakerId)

    // Decode Base64 data URI to a buffer
    const audioBase64 = ttsAudioDataUri.split(',')[1]
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    console.log(`[Segment ${segment.index}] TTS complete, buffer size: ${audioBuffer.length} bytes`)

    // 上傳音頻取得公開 URL
    const audioFilePath = `temp/segment_audio_${segment.id}_${Date.now()}.wav`
    const publicAudioUrl = await uploadTempBuffer(audioBuffer, audioFilePath, 'audio/wav')
    result.audioUrl = publicAudioUrl
    console.log(`[Segment ${segment.index}] Audio uploaded: ${publicAudioUrl}`)

    // Step 2: Whisper 對齊字幕（分段送出更準確）
    result.status = 'whisper'
    onStatusChange?.('whisper')
    console.log(`[Segment ${segment.index}] Starting Whisper alignment...`)

    try {
      const whisperResult = await transcribeAudio(audioBuffer, 'segment.wav', 'zh')
      result.audioDuration = whisperResult.duration

      if (whisperResult.words && whisperResult.words.length > 0) {
        const subtitles = alignTranscriptWithWhisperTimings(segment.text, whisperResult.words)
        result.subtitles = subtitles
        console.log(`[Segment ${segment.index}] Whisper complete: ${subtitles.length} subtitle segments, duration=${whisperResult.duration}s`)
      } else {
        // Fallback: 如果沒有 words，用簡單分段
        result.subtitles = createFallbackSubtitles(segment.text, whisperResult.duration)
        console.log(`[Segment ${segment.index}] Whisper fallback: no words, created ${result.subtitles.length} segments`)
      }
    } catch (whisperError) {
      console.error(`[Segment ${segment.index}] Whisper error:`, whisperError)
      // Whisper 失敗不影響整體流程，使用估算時長
      const estimatedDuration = estimateDurationFromText(segment.text)
      result.audioDuration = estimatedDuration
      result.subtitles = createFallbackSubtitles(segment.text, estimatedDuration)
    }

    // Step 3: WaveSpeed 生成影片
    result.status = 'video'
    onStatusChange?.('video')
    console.log(`[Segment ${segment.index}] Starting WaveSpeed video generation...`)

    const { requestId } = await generateWaveSpeedVideo({
      audioUrl: publicAudioUrl,
      imageUrl: avatarUrl,
      prompt: waveSpeedPrompt || DEFAULT_WAVESPEED_PROMPT,
      resolution: waveSpeedResolution || '720p',
    })

    result.videoTaskId = requestId
    console.log(`[Segment ${segment.index}] WaveSpeed task started: ${requestId}`)

    // 返回時 status 仍為 'video'，等待 polling 完成後才變成 'completed'
    return {
      segment: result,
      audioBuffer,
    }
  } catch (error: any) {
    console.error(`[Segment ${segment.index}] Processing error:`, error)
    result.status = 'failed'
    result.error = error.message || 'Unknown error'
    return { segment: result }
  }
}

/**
 * 平行處理多個分段
 */
export async function processSegmentsInParallel(
  segments: TranscriptSegment[],
  options: ProcessSegmentOptions,
  onSegmentUpdate?: (segment: GeneratedSegment) => void
): Promise<GeneratedSegment[]> {
  // 使用 Promise.allSettled 確保部分失敗不影響其他段落
  const results = await Promise.allSettled(
    segments.map(async (segment) => {
      const result = await processOneSegment(segment, options, (status) => {
        onSegmentUpdate?.({
          id: segment.id,
          index: segment.index,
          text: segment.text,
          status,
        })
      })
      onSegmentUpdate?.(result.segment)
      return result.segment
    })
  )

  // 處理結果
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        id: segments[index].id,
        index: segments[index].index,
        text: segments[index].text,
        status: 'failed' as SegmentStatus,
        error: result.reason?.message || 'Unknown error',
      }
    }
  })
}

/**
 * 只重新生成影片（使用現有音頻）
 */
export async function regenerateVideoOnly(
  segment: GeneratedSegment,
  avatarUrl: string,
  waveSpeedPrompt?: string,
  waveSpeedResolution?: WaveSpeedResolution
): Promise<GeneratedSegment> {
  if (!segment.audioUrl) {
    throw new Error('No audio URL available for video regeneration')
  }

  try {
    console.log(`[Segment ${segment.index}] Regenerating video only...`)

    const { requestId } = await generateWaveSpeedVideo({
      audioUrl: segment.audioUrl,
      imageUrl: avatarUrl,
      prompt: waveSpeedPrompt || DEFAULT_WAVESPEED_PROMPT,
      resolution: waveSpeedResolution || '720p',
    })

    return {
      ...segment,
      status: 'video',
      videoTaskId: requestId,
      videoUrl: undefined, // 清除舊的 videoUrl
      error: undefined,
    }
  } catch (error: any) {
    console.error(`[Segment ${segment.index}] Video regeneration error:`, error)
    return {
      ...segment,
      status: 'failed',
      error: error.message || 'Video regeneration failed',
    }
  }
}

/**
 * 從文字估算語音時長（每秒約 5 個中文字）
 */
function estimateDurationFromText(text: string): number {
  const charCount = text.replace(/\s/g, '').length
  return Math.max(1, charCount / 5)
}

/**
 * 創建降級字幕（無 Whisper 時使用）
 */
function createFallbackSubtitles(text: string, duration: number): TimedSegment[] {
  // 按標點符號分段
  const punctuationPattern = /[，。！？、；：,\.!?\n]+/g
  const rawSegments = text
    .split(punctuationPattern)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (rawSegments.length === 0) {
    return [{
      text: text.trim(),
      startTime: 0,
      endTime: duration,
    }]
  }

  // 計算每個字元的時間
  const totalChars = rawSegments.reduce((sum, s) => sum + s.length, 0)
  const timePerChar = duration / totalChars

  const segments: TimedSegment[] = []
  let currentTime = 0

  for (const segmentText of rawSegments) {
    const segmentDuration = segmentText.length * timePerChar
    segments.push({
      text: segmentText,
      startTime: currentTime,
      endTime: currentTime + segmentDuration,
    })
    currentTime += segmentDuration
  }

  return segments
}
