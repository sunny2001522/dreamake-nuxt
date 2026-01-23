/**
 * GET /api/generate/segmented/[jobId]
 *
 * 查詢分段生成任務的進度
 * 同時會 polling 各段 WaveSpeed 的狀態並更新
 */

import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { getWaveSpeedVideoStatus } from '~/server/utils/wavespeed'
import type {
  GeneratedSegment,
  SegmentedJobProgressResponse,
  SegmentedJobStatus,
  SegmentStatus,
  TimedSegment,
  DbSegmentedJob,
  DbJobSegment,
} from '~/types'

export default defineEventHandler(async (event): Promise<SegmentedJobProgressResponse> => {
  const supabase = getSupabaseAdmin()

  try {
    const jobId = getRouterParam(event, 'jobId')

    if (!jobId) {
      throw createError({ statusCode: 400, message: 'jobId is required' })
    }

    // 查詢 job 記錄
    const { data: job, error: jobError } = await supabase
      .from('segmented_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw createError({ statusCode: 404, message: 'Job not found' })
    }

    const jobData = job as DbSegmentedJob

    // 查詢所有分段
    const { data: segmentsData, error: segmentsError } = await supabase
      .from('job_segments')
      .select('*')
      .eq('job_id', jobId)
      .order('index', { ascending: true })

    if (segmentsError) {
      throw createError({ statusCode: 500, message: 'Failed to fetch segments' })
    }

    const dbSegments = (segmentsData || []) as DbJobSegment[]

    // 處理每個分段，polling WaveSpeed 狀態
    const segments: GeneratedSegment[] = []
    let hasUpdates = false

    for (const dbSeg of dbSegments) {
      const segment: GeneratedSegment = {
        id: dbSeg.id,
        index: dbSeg.index,
        text: dbSeg.text,
        status: dbSeg.status as SegmentStatus,
        error: dbSeg.error || undefined,
        audioUrl: dbSeg.audio_url || undefined,
        audioDuration: dbSeg.audio_duration || undefined,
        subtitles: dbSeg.subtitles as TimedSegment[] | undefined,
        videoTaskId: dbSeg.video_task_id || undefined,
        videoUrl: dbSeg.video_url || undefined,
      }

      // 如果是 'video' 狀態且有 taskId，polling WaveSpeed 狀態
      if (segment.status === 'video' && segment.videoTaskId && !segment.videoUrl) {
        try {
          const wsStatus = await getWaveSpeedVideoStatus(segment.videoTaskId)
          console.log(`[Segment ${segment.index}] WaveSpeed status:`, wsStatus.status)

          if (wsStatus.status === 'completed' && wsStatus.videoUrl) {
            segment.videoUrl = wsStatus.videoUrl
            segment.status = 'completed'
            hasUpdates = true

            // 更新資料庫
            await supabase
              .from('job_segments')
              .update({
                status: 'completed',
                video_url: wsStatus.videoUrl,
              })
              .eq('id', segment.id)

          } else if (wsStatus.status === 'failed') {
            segment.status = 'failed'
            segment.error = wsStatus.error || 'WaveSpeed generation failed'
            hasUpdates = true

            // 更新資料庫
            await supabase
              .from('job_segments')
              .update({
                status: 'failed',
                error: segment.error,
              })
              .eq('id', segment.id)
          }
          // 'pending' 或 'processing' 狀態保持不變
        } catch (wsError: any) {
          console.error(`[Segment ${segment.index}] WaveSpeed polling error:`, wsError.message)
          // polling 錯誤不影響整體狀態，下次再試
        }
      }

      segments.push(segment)
    }

    // 計算進度統計
    const completed = segments.filter(s => s.status === 'completed').length
    const failed = segments.filter(s => s.status === 'failed').length
    const processing = segments.filter(s => ['tts', 'whisper', 'video', 'pending'].includes(s.status)).length

    // 計算全域時間軸
    let globalTime = 0
    for (const seg of segments) {
      if (seg.status === 'completed' && seg.audioDuration) {
        seg.globalStartTime = globalTime
        globalTime += seg.audioDuration
        seg.globalEndTime = globalTime
      }
    }

    // 判斷整體狀態
    let overallStatus: SegmentedJobStatus = jobData.status as SegmentedJobStatus
    if (completed + failed >= jobData.total_segments) {
      overallStatus = failed > 0 ? 'failed' : 'completed'

      // 如果狀態變更，更新資料庫
      if (overallStatus !== jobData.status) {
        await supabase
          .from('segmented_jobs')
          .update({
            status: overallStatus,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      }
    }

    // 計算總時長
    const totalDuration = segments
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.audioDuration || 0), 0)

    return {
      jobId,
      status: overallStatus,
      progress: {
        total: jobData.total_segments,
        completed,
        failed,
        processing,
      },
      segments,
      totalDuration: totalDuration > 0 ? totalDuration : undefined,
    }
  } catch (error: any) {
    console.error('Segmented job progress API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch job progress',
      data: { details: String(error) },
    })
  }
})
