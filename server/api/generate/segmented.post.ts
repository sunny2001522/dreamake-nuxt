/**
 * POST /api/generate/segmented
 *
 * 分段生成影片的主入口 API
 * 1. 語意分段逐字稿
 * 2. 裁切頭像
 * 3. 平行處理每段：TTS → Whisper → WaveSpeed
 * 4. 存入 Supabase，回傳 jobId 供前端 polling
 */

import { nanoid } from 'nanoid'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cropImageToAspectRatio } from '~/server/utils/image/serverImageProcessor'
import { getSupabaseAdmin } from '~/server/utils/supabase-admin'
import { STORAGE_BUCKET } from '~/server/utils/supabase'
import { processSegmentsInParallel, uploadTempBuffer } from '~/server/utils/segmentedGeneration'
import { getTokenBalance, consumeTokens, initializeUserSubscription } from '~/server/utils/subscription/tokenService'
import { VIDEO_TOKEN_COSTS, estimateDurationFromTranscript } from '~/types/subscription'
import type {
  TranscriptSegment,
  GeneratedSegment,
  SegmentedGenerationRequest,
  SegmentedGenerationResponse,
  AspectRatio,
  VideoModel,
} from '~/types'

// Base Token cost for segmented video generation
const VIDEO_BASE_TOKEN = 2

export default defineEventHandler(async (event): Promise<SegmentedGenerationResponse> => {
  const config = useRuntimeConfig()
  const supabase = getSupabaseAdmin()

  try {
    const body: SegmentedGenerationRequest = await readBody(event)
    const {
      transcript,
      speakerId,
      avatarUrl,
      aspectRatio = 'portrait',
      videoModel = 'wavespeed',
      waveSpeedPrompt,
      waveSpeedResolution = '720p',
      userId,
      avatarRotation = 0,
      avatarPanX = 0,
      avatarPanY = 0,
    } = body

    // 驗證必要參數
    if (!transcript) {
      throw createError({ statusCode: 400, message: 'Transcript is required' })
    }
    if (!speakerId) {
      throw createError({ statusCode: 400, message: 'Speaker ID is required' })
    }
    if (!avatarUrl) {
      throw createError({ statusCode: 400, message: 'Avatar URL is required' })
    }

    console.log('Starting segmented video generation...')
    console.log({ transcript: transcript.substring(0, 50) + '...', speakerId, avatarUrl, videoModel })

    // Step 1: 語意分段
    console.log('Step 1: Segmenting transcript...')
    const segments = await segmentTranscript(transcript, config.geminiApiKey)
    console.log(`Transcript segmented into ${segments.length} parts`)

    // 計算估計 Token 消耗
    const durationSeconds = estimateDurationFromTranscript(transcript)
    const perSecondCost = VIDEO_TOKEN_COSTS[videoModel as 'wavespeed' | 'vidnoz'].perSecond
    const estimatedCost = VIDEO_BASE_TOKEN + Math.round(perSecondCost * durationSeconds)

    // 檢查 Token 餘額
    if (userId) {
      let balance = await getTokenBalance(userId)
      if (!balance) {
        const result = await initializeUserSubscription(userId)
        balance = result.balance
      }

      console.log('Token check:', { userId, required: estimatedCost, balance: balance.balance })

      if (balance.balance < estimatedCost) {
        throw createError({
          statusCode: 402,
          message: `Token 餘額不足，需要約 ${estimatedCost} Token，目前餘額 ${balance.balance}`,
        })
      }
    }

    // Step 2: 裁切頭像
    console.log('Step 2: Cropping avatar image...')
    const croppedBuffer = await cropImageToAspectRatio({
      imageUrl: avatarUrl,
      aspectRatio: aspectRatio as AspectRatio,
      rotation: avatarRotation,
      panX: avatarPanX,
      panY: avatarPanY,
    })

    // 上傳裁切後的頭像
    const croppedImagePath = `temp/segmented_avatar_${Date.now()}.jpg`
    const croppedImageUrl = await uploadTempBuffer(croppedBuffer, croppedImagePath, 'image/jpeg')
    console.log('Cropped avatar uploaded:', croppedImageUrl)

    // Step 3: 建立 Job 記錄
    const jobId = nanoid()
    console.log('Step 3: Creating job record...', jobId)

    const { error: jobError } = await supabase
      .from('segmented_jobs')
      .insert({
        id: jobId,
        user_id: userId || null,
        status: 'generating',
        transcript,
        speaker_id: speakerId,
        avatar_url: croppedImageUrl,
        aspect_ratio: aspectRatio,
        video_model: videoModel,
        wavespeed_prompt: waveSpeedPrompt || null,
        wavespeed_resolution: waveSpeedResolution,
        total_segments: segments.length,
        completed_segments: 0,
        failed_segments: 0,
      })

    if (jobError) {
      console.error('Failed to create job record:', jobError)
      throw createError({ statusCode: 500, message: 'Failed to create job record' })
    }

    // Step 4: 建立各分段記錄
    const segmentInserts = segments.map(seg => ({
      id: seg.id,
      job_id: jobId,
      index: seg.index,
      text: seg.text,
      status: 'pending',
    }))

    const { error: segmentsError } = await supabase
      .from('job_segments')
      .insert(segmentInserts)

    if (segmentsError) {
      console.error('Failed to create segment records:', segmentsError)
      throw createError({ statusCode: 500, message: 'Failed to create segment records' })
    }

    // Step 5: 平行處理各分段（非阻塞，後台執行）
    console.log('Step 5: Starting parallel segment processing...')

    // 非同步執行，不等待完成
    processSegmentsInBackground(
      jobId,
      segments,
      {
        speakerId,
        avatarUrl: croppedImageUrl,
        waveSpeedPrompt,
        waveSpeedResolution,
      },
      supabase
    )

    // 消耗 Token
    if (userId) {
      const consumeResult = await consumeTokens({
        userId,
        operationType: 'video_generation',
        description: `分段影片生成 (${videoModel === 'wavespeed' ? '高品質' : '一般品質'})`,
        metadata: { videoModel, durationSeconds, jobId, segmentCount: segments.length },
        customCost: estimatedCost,
      })

      if (consumeResult.success) {
        console.log('Token consumed:', consumeResult)
      } else {
        console.error('Token deduction failed:', consumeResult.error)
      }
    }

    // 回傳初始狀態
    const initialSegments: GeneratedSegment[] = segments.map(seg => ({
      id: seg.id,
      index: seg.index,
      text: seg.text,
      status: 'pending',
    }))

    return {
      jobId,
      status: 'generating',
      segments: initialSegments,
      totalSegments: segments.length,
    }
  } catch (error: any) {
    console.error('Segmented Generation API Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Segmented generation failed',
      data: { details: String(error) },
    })
  }
})

/**
 * 使用 Gemini AI 語意分段
 */
async function segmentTranscript(transcript: string, apiKey: string): Promise<TranscriptSegment[]> {
  // 如果逐字稿太短，直接返回單一段落
  if (transcript.length < 100) {
    return [{
      id: nanoid(),
      index: 0,
      text: transcript.trim(),
    }]
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const prompt = `你是一個專業的短影音分段專家。請將以下逐字稿按語意分成多個段落。

【分段規則】
1. 每段約 2-4 句話（約 100-200 字）
2. 在語意完整處斷點（話題轉換、論點結束）
3. 避免在句子中間斷開
4. 段落數控制在 3-6 段

【逐字稿】
${transcript}

【輸出格式】JSON 陣列:
[{"index": 0, "text": "..."}, {"index": 1, "text": "..."}, ...]

直接輸出 JSON，保留原文用字。`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    let parsedSegments: Array<{ index: number; text: string }>
    try {
      parsedSegments = JSON.parse(responseText)
    } catch {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsedSegments = JSON.parse(jsonMatch[0])
      } else {
        // 降級：簡單分段
        return simpleSegment(transcript)
      }
    }

    return parsedSegments.map((seg, idx) => ({
      id: nanoid(),
      index: seg.index ?? idx,
      text: seg.text.trim(),
    }))
  } catch (error) {
    console.error('Gemini segmentation failed, using fallback:', error)
    return simpleSegment(transcript)
  }
}

/**
 * 簡單分段（降級方案）
 */
function simpleSegment(transcript: string): TranscriptSegment[] {
  const sentences = transcript.split(/(?<=[。！？\n])/g).filter(s => s.trim())

  const segments: TranscriptSegment[] = []
  let currentSegment = ''
  let segmentIndex = 0

  for (const sentence of sentences) {
    currentSegment += sentence

    if (currentSegment.length >= 150 || (currentSegment.match(/[。！？]/g)?.length ?? 0) >= 3) {
      segments.push({
        id: nanoid(),
        index: segmentIndex++,
        text: currentSegment.trim(),
      })
      currentSegment = ''
    }
  }

  if (currentSegment.trim()) {
    segments.push({
      id: nanoid(),
      index: segmentIndex,
      text: currentSegment.trim(),
    })
  }

  return segments.length > 0 ? segments : [{
    id: nanoid(),
    index: 0,
    text: transcript.trim(),
  }]
}

/**
 * 後台非同步處理分段
 */
async function processSegmentsInBackground(
  jobId: string,
  segments: TranscriptSegment[],
  options: {
    speakerId: string
    avatarUrl: string
    waveSpeedPrompt?: string
    waveSpeedResolution?: string
  },
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  try {
    const results = await processSegmentsInParallel(
      segments,
      {
        speakerId: options.speakerId,
        avatarUrl: options.avatarUrl,
        waveSpeedPrompt: options.waveSpeedPrompt,
        waveSpeedResolution: options.waveSpeedResolution as any,
      },
      async (segment) => {
        // 更新單一分段狀態到資料庫
        await supabase
          .from('job_segments')
          .update({
            status: segment.status,
            audio_url: segment.audioUrl || null,
            audio_duration: segment.audioDuration || null,
            subtitles: segment.subtitles || null,
            video_task_id: segment.videoTaskId || null,
            video_url: segment.videoUrl || null,
            error: segment.error || null,
          })
          .eq('id', segment.id)
      }
    )

    console.log(`[Job ${jobId}] All segments processed, results:`, results.map(r => ({ id: r.id, status: r.status })))
  } catch (error) {
    console.error(`[Job ${jobId}] Background processing error:`, error)

    // 標記 job 為失敗
    await supabase
      .from('segmented_jobs')
      .update({ status: 'failed' })
      .eq('id', jobId)
  }
}
