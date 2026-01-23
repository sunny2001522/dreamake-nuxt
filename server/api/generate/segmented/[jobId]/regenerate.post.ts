/**
 * POST /api/generate/segmented/[jobId]/regenerate
 *
 * 重新生成單一分段
 * - type = 'audio': 重新 TTS + Whisper + WaveSpeed
 * - type = 'video': 只重新 WaveSpeed (使用現有音檔)
 * - type = 'both': 同 'audio'
 */

import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { processOneSegment, regenerateVideoOnly } from '~/server/utils/segmentedGeneration'
import type {
  RegenerateSegmentRequest,
  RegenerateSegmentResponse,
  GeneratedSegment,
  TranscriptSegment,
  SegmentStatus,
  TimedSegment,
  DbSegmentedJob,
  DbJobSegment,
  WaveSpeedResolution,
} from '~/types'

export default defineEventHandler(async (event): Promise<RegenerateSegmentResponse> => {
  const supabase = getSupabaseAdmin()

  try {
    const jobId = getRouterParam(event, 'jobId')
    const body: RegenerateSegmentRequest = await readBody(event)
    const { segmentIndex, type } = body

    if (!jobId) {
      throw createError({ statusCode: 400, message: 'jobId is required' })
    }
    if (segmentIndex === undefined || segmentIndex === null) {
      throw createError({ statusCode: 400, message: 'segmentIndex is required' })
    }
    if (!type || !['audio', 'video', 'both'].includes(type)) {
      throw createError({ statusCode: 400, message: 'type must be "audio", "video", or "both"' })
    }

    // 查詢 job
    const { data: job, error: jobError } = await supabase
      .from('segmented_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw createError({ statusCode: 404, message: 'Job not found' })
    }

    const jobData = job as DbSegmentedJob

    // 查詢指定分段
    const { data: segmentData, error: segmentError } = await supabase
      .from('job_segments')
      .select('*')
      .eq('job_id', jobId)
      .eq('index', segmentIndex)
      .single()

    if (segmentError || !segmentData) {
      throw createError({ statusCode: 404, message: 'Segment not found' })
    }

    const dbSegment = segmentData as DbJobSegment

    // 更新分段狀態為處理中
    const regeneratingStatus: SegmentStatus = type === 'video' ? 'video' : 'tts'
    await supabase
      .from('job_segments')
      .update({
        status: regeneratingStatus,
        error: null,
        retry_count: dbSegment.retry_count + 1,
      })
      .eq('id', dbSegment.id)

    let updatedSegment: GeneratedSegment

    if (type === 'video') {
      // 只重新生成影片（使用現有音檔）
      if (!dbSegment.audio_url) {
        throw createError({ statusCode: 400, message: 'No audio available for video-only regeneration' })
      }

      const existingSegment: GeneratedSegment = {
        id: dbSegment.id,
        index: dbSegment.index,
        text: dbSegment.text,
        status: 'video',
        audioUrl: dbSegment.audio_url,
        audioDuration: dbSegment.audio_duration || undefined,
        subtitles: dbSegment.subtitles as TimedSegment[] | undefined,
      }

      updatedSegment = await regenerateVideoOnly(
        existingSegment,
        jobData.avatar_url,
        jobData.wavespeed_prompt || undefined,
        (jobData.wavespeed_resolution as WaveSpeedResolution) || undefined
      )
    } else {
      // 重新生成音訊 + 影片（type = 'audio' 或 'both'）
      const transcriptSegment: TranscriptSegment = {
        id: dbSegment.id,
        index: dbSegment.index,
        text: dbSegment.text,
      }

      const result = await processOneSegment(
        transcriptSegment,
        {
          speakerId: jobData.speaker_id,
          avatarUrl: jobData.avatar_url,
          waveSpeedPrompt: jobData.wavespeed_prompt || undefined,
          waveSpeedResolution: (jobData.wavespeed_resolution as WaveSpeedResolution) || undefined,
        },
        async (status) => {
          // 即時更新狀態
          await supabase
            .from('job_segments')
            .update({ status })
            .eq('id', dbSegment.id)
        }
      )

      updatedSegment = result.segment
    }

    // 更新資料庫
    await supabase
      .from('job_segments')
      .update({
        status: updatedSegment.status,
        audio_url: updatedSegment.audioUrl || dbSegment.audio_url,
        audio_duration: updatedSegment.audioDuration || dbSegment.audio_duration,
        subtitles: updatedSegment.subtitles || dbSegment.subtitles,
        video_task_id: updatedSegment.videoTaskId || null,
        video_url: updatedSegment.videoUrl || null,
        error: updatedSegment.error || null,
      })
      .eq('id', dbSegment.id)

    // 如果 job 之前是 failed 或 completed，重置為 generating
    if (jobData.status === 'failed' || jobData.status === 'completed') {
      await supabase
        .from('segmented_jobs')
        .update({
          status: 'generating',
          completed_at: null,
        })
        .eq('id', jobId)
    }

    console.log(`[Job ${jobId}] Segment ${segmentIndex} regeneration started, type: ${type}`)

    return {
      success: true,
      segment: updatedSegment,
    }
  } catch (error: any) {
    console.error('Regenerate segment API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to regenerate segment',
      data: { details: String(error) },
    })
  }
})
