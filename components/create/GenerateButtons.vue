<script setup lang="ts">
import type { GenerationRecord, AspectRatio, VideoModel } from '~/types'
import { Smartphone, Monitor, Gem } from 'lucide-vue-next'
import {
  VIDEO_TOKEN_COSTS,
  calculateVideoTokenCost,
  estimateDurationFromTranscript,
} from '~/types/subscription'

// Base Token costs
const VIDEO_BASE_TOKEN = 2
const VOICE_BASE_TOKEN = 1

const generationStore = useGenerationStore()
const authStore = useAuthStore()
const toastStore = useToastStore()
const router = useRouter()

const { draft, isGenerating, stage } = storeToRefs(generationStore)

// Aspect ratio options
const aspectRatioOptions: { value: AspectRatio; label: string; icon: any }[] = [
  { value: 'portrait', label: '9:16', icon: Smartphone },
  { value: 'landscape', label: '16:9', icon: Monitor },
]

// Video model options
const videoModelOptions: { value: VideoModel; label: string; tokenCost: number }[] = [
  { value: 'vidnoz', label: '一般品質', tokenCost: VIDEO_TOKEN_COSTS.vidnoz.perMinute },
  { value: 'wavespeed', label: '高品質', tokenCost: VIDEO_TOKEN_COSTS.wavespeed.perMinute },
]

// 預估 Token 消耗
const estimatedDurationSeconds = computed(() => {
  return estimateDurationFromTranscript(draft.value.transcript)
})

const estimatedVideoTokenCost = computed(() => {
  const model = draft.value.videoModel as 'wavespeed' | 'vidnoz'
  return VIDEO_BASE_TOKEN + calculateVideoTokenCost(model, estimatedDurationSeconds.value)
})

// 語音 Token 消耗計算 (基礎 + 時長計算)
const estimatedVoiceTokenCost = computed(() => {
  // 語音使用 vidnoz 的費率計算
  return VOICE_BASE_TOKEN + calculateVideoTokenCost('vidnoz', estimatedDurationSeconds.value)
})

// 格式化時長顯示
const formattedDuration = computed(() => {
  const seconds = estimatedDurationSeconds.value
  if (seconds < 60) {
    return `${seconds} 秒`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes} 分鐘`
  }
  return `${minutes} 分 ${remainingSeconds} 秒`
})

function setAspectRatio(ratio: AspectRatio) {
  generationStore.updateDraft({ aspectRatio: ratio })
}

function setVideoModel(model: VideoModel) {
  generationStore.updateDraft({ videoModel: model })
}

// Generation composable
const videoGeneration = useVideoGeneration()
const { uploadVideoToStorage, createVideo } = useVideoStorage()

// Subtitle generation helper
async function generateSubtitles(audioUrl: string, transcript: string) {
  if (!draft.value.subtitleEnabled) return

  const startTime = Date.now()
  console.log('[Subtitle] Start generating...', { audioUrl: audioUrl.substring(0, 50) })

  try {
    generationStore.setLoadingSubtitles(true)

    const response = await $fetch('/api/subtitle', {
      method: 'POST',
      body: { audioUrl, transcript },
    })

    const result = response as {
      segments: Array<{ text: string; startTime: number; endTime: number }>
      hasTimestamps: boolean
      source: string
    }

    generationStore.setSubtitleSegments(result.segments, result.hasTimestamps)
    console.log(`[Subtitle] Completed in ${Date.now() - startTime}ms`, {
      count: result.segments.length,
      hasTimestamps: result.hasTimestamps,
      source: result.source,
    })
  } catch (err) {
    console.error('[Subtitle] Failed:', err)
    // Fallback: generate simple text segments
    const segments = simpleTextSegmentation(transcript)
    generationStore.setSubtitleSegments(segments, false)
  } finally {
    generationStore.setLoadingSubtitles(false)
  }
}

// Simple text segmentation fallback
function simpleTextSegmentation(transcript: string) {
  const cleanText = transcript.replace(/[，。！？、；：""''（）【】《》\s]+/g, '').trim()
  if (!cleanText) return []

  const segments: Array<{ text: string; startTime: number; endTime: number }> = []
  const maxChars = 10

  let i = 0
  while (i < cleanText.length) {
    const remainingChars = cleanText.length - i
    let segmentLength = Math.min(maxChars, remainingChars)
    if (remainingChars <= maxChars) {
      segmentLength = remainingChars
    } else if (remainingChars - maxChars < 6) {
      segmentLength = Math.ceil(remainingChars / 2)
    }
    segments.push({
      text: cleanText.slice(i, i + segmentLength),
      startTime: -1,
      endTime: -1,
    })
    i += segmentLength
  }
  return segments
}

// Check if generation can proceed
const canGenerate = computed(() => {
  return (
    draft.value.transcript.trim().length > 0 &&
    draft.value.avatarPreview &&
    draft.value.voicePreview?.speakerId &&
    !isGenerating.value
  )
})

// Error messages for disabled state
const disabledReason = computed(() => {
  if (isGenerating.value) return '正在生成中...'
  if (!draft.value.transcript.trim()) return '請先輸入腳本內容'
  if (!draft.value.avatarPreview) return '請先選擇頭像'
  if (!draft.value.voicePreview?.speakerId) return '請先選擇語音'
  return null
})

// Voice-only generation
async function handleGenerateVoiceOnly() {
  if (!canGenerate.value) {
    toastStore.warning(disabledReason.value || '請先填寫腳本、選擇頭像和語音')
    return
  }

  // Check auth
  if (!authStore.user) {
    toastStore.error('請先登入帳號以使用生成功能')
    const { $manager } = useNuxtApp()
    await authStore.login($manager as any, '/create')
    return
  }

  try {
    generationStore.setStage('voice')
    generationStore.setError(null)

    // Generate voice TTS
    const speakerId = draft.value.voicePreview!.speakerId!
    const result = await videoGeneration.generateVoice(speakerId, draft.value.transcript)

    // Generate subtitles from audio
    if (draft.value.subtitleEnabled) {
      generationStore.setStage('subtitle')
      await generateSubtitles(result.audioUrl, draft.value.transcript)
    }

    // Create audio-only record
    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: 'completed',
      audioUrl: result.audioUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: draft.value.avatarPreview,
    }

    generationStore.setResult(record)
    generationStore.setStage('complete')
    toastStore.success('語音生成完成！')
  } catch (err: any) {
    console.error('Voice generation failed:', err)
    generationStore.setError(err.message || '語音生成失敗')
    generationStore.setStage('idle')
    toastStore.error('語音生成失敗', err.message)
  }
}

// Full video generation
async function handleGenerateVideo() {
  if (!canGenerate.value) {
    toastStore.warning(disabledReason.value || '請先填寫腳本、選擇頭像和語音')
    return
  }

  // Check auth
  if (!authStore.user) {
    toastStore.error('請先登入帳號以使用生成功能')
    const { $manager } = useNuxtApp()
    await authStore.login($manager as any, '/create')
    return
  }

  // Validate avatar URL
  if (!draft.value.avatarPreview) {
    toastStore.error('請上傳頭像照片以生成影片')
    return
  }

  try {
    generationStore.resetGeneration()
    generationStore.setStage('voice')

    const speakerId = draft.value.voicePreview!.speakerId!
    const avatarUrl = draft.value.avatarPreview

    // Start video generation
    const result = await videoGeneration.startGeneration({
      transcript: draft.value.transcript,
      speakerId,
      avatarUrl,
      aspectRatio: draft.value.aspectRatio,
      videoModel: draft.value.videoModel,
      waveSpeedPrompt: draft.value.waveSpeedPrompt,
    })

    // Generate subtitles in parallel with video generation
    if (draft.value.subtitleEnabled) {
      generationStore.setStage('subtitle')
      await generateSubtitles(result.audioUrl, draft.value.transcript)
    }

    // Poll for completion
    generationStore.setStage('video')
    const videoResult = await videoGeneration.pollUntilComplete(
      result.taskId,
      result.pollEndpoint,
      {
        onStatusChange: (status) => {
          console.log('Video status:', status)
        },
      }
    )

    // Create completed record with external URL first (for immediate preview)
    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: 'completed',
      audioUrl: result.audioUrl,
      videoUrl: videoResult.videoUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: avatarUrl,
    }

    generationStore.setResult(record)
    generationStore.setStage('complete')
    toastStore.success('影片生成完成！')

    // Background upload to Supabase Storage (non-blocking)
    const userId = authStore.authInfo.email || authStore.authInfo.sub

    // Validate userId before attempting upload
    if (!userId) {
      console.error('[Video Save] Cannot save video: userId is empty', {
        email: authStore.authInfo.email,
        sub: authStore.authInfo.sub,
      })
      toastStore.warning('無法儲存影片：請重新登入')
      return
    }

    console.log('[Video Save] Starting background upload for user:', userId)
    console.log('[Video Save] External URL:', videoResult.videoUrl)
    toastStore.info('正在將影片儲存到雲端...')

    // Use immediately invoked async function to properly handle errors
    ;(async () => {
      try {
        const supabaseVideoUrl = await uploadVideoToStorage(videoResult.videoUrl, userId)
        console.log('[Video Save] Upload successful:', supabaseVideoUrl)

        await createVideo({
          user_id: userId,
          transcript: draft.value.transcript,
          video_url: supabaseVideoUrl,
          original_video_url: videoResult.videoUrl, // Store original CDN URL for faster access within 3 days
          audio_url: result.audioUrl,
          aspect_ratio: draft.value.aspectRatio,
          status: 'completed',
          speaker_id: speakerId,
          title: draft.value.title || null,
          avatar_preview: avatarUrl,
          subtitle_style: draft.value.subtitleEnabled ? draft.value.subtitleFont : 'none',
          voice_preview: draft.value.voicePreview?.name || null,
        })
        console.log('[Video Save] Database record created')
        toastStore.success('影片已儲存到雲端')
      } catch (uploadErr: any) {
        console.error('[Video Save] Upload failed:', uploadErr)
        toastStore.warning('雲端儲存失敗，嘗試使用臨時連結...')

        // Fallback: save with external URL (may expire)
        try {
          await createVideo({
            user_id: userId,
            transcript: draft.value.transcript,
            video_url: videoResult.videoUrl,
            original_video_url: videoResult.videoUrl, // Same as video_url in fallback case
            audio_url: result.audioUrl,
            aspect_ratio: draft.value.aspectRatio,
            status: 'completed',
            speaker_id: speakerId,
            title: draft.value.title || null,
            avatar_preview: avatarUrl,
            subtitle_style: draft.value.subtitleEnabled ? draft.value.subtitleFont : 'none',
            voice_preview: draft.value.voicePreview?.name || null,
          })
          console.log('[Video Save] Fallback: saved with external URL')
          toastStore.info('影片已儲存（使用臨時連結，可能會過期）')
        } catch (dbErr: any) {
          console.error('[Video Save] Database save failed:', dbErr)
          toastStore.error('影片儲存失敗')
        }
      }
    })()
  } catch (err: any) {
    console.error('Video generation failed:', err)
    generationStore.setError(err.message || '影片生成失敗')
    generationStore.setStage('error')
    toastStore.error('影片生成失敗', err.message)
  }
}

// Generate video from existing audio (when audio was already generated)
async function handleContinueToVideo() {
  const existingResult = generationStore.generatedResult
  if (!existingResult?.audioUrl || !existingResult?.speakerId) {
    toastStore.warning('請先生成語音')
    return
  }

  if (!draft.value.avatarPreview) {
    toastStore.error('請上傳頭像照片以生成影片')
    return
  }

  try {
    generationStore.setStage('video')

    // Start video generation with existing audio
    const result = await videoGeneration.startGeneration({
      transcript: draft.value.transcript,
      speakerId: existingResult.speakerId,
      avatarUrl: draft.value.avatarPreview,
      aspectRatio: draft.value.aspectRatio,
      videoModel: draft.value.videoModel,
      waveSpeedPrompt: draft.value.waveSpeedPrompt,
    })

    // Poll for completion
    const videoResult = await videoGeneration.pollUntilComplete(
      result.taskId,
      result.pollEndpoint
    )

    // Update record with video
    const record: GenerationRecord = {
      ...existingResult,
      videoUrl: videoResult.videoUrl,
      status: 'completed',
    }

    generationStore.setResult(record)
    generationStore.setStage('complete')
    toastStore.success('影片生成完成！')

    // Background upload to Supabase Storage (non-blocking)
    const userId = authStore.authInfo.email || authStore.authInfo.sub

    // Validate userId before attempting upload
    if (!userId) {
      console.error('[Video Save] Cannot save video: userId is empty', {
        email: authStore.authInfo.email,
        sub: authStore.authInfo.sub,
      })
      toastStore.warning('無法儲存影片：請重新登入')
      return
    }

    console.log('[Video Save] Starting background upload for user:', userId)
    console.log('[Video Save] External URL:', videoResult.videoUrl)
    toastStore.info('正在將影片儲存到雲端...')

    // Use immediately invoked async function to properly handle errors
    ;(async () => {
      try {
        const supabaseVideoUrl = await uploadVideoToStorage(videoResult.videoUrl, userId)
        console.log('[Video Save] Upload successful:', supabaseVideoUrl)

        await createVideo({
          user_id: userId,
          transcript: draft.value.transcript,
          video_url: supabaseVideoUrl,
          original_video_url: videoResult.videoUrl, // Store original CDN URL for faster access within 3 days
          audio_url: existingResult.audioUrl || null,
          aspect_ratio: draft.value.aspectRatio,
          status: 'completed',
          speaker_id: existingResult.speakerId || null,
          title: draft.value.title || null,
          avatar_preview: draft.value.avatarPreview || null,
          subtitle_style: draft.value.subtitleEnabled ? draft.value.subtitleFont : 'none',
          voice_preview: draft.value.voicePreview?.name || null,
        })
        console.log('[Video Save] Database record created')
        toastStore.success('影片已儲存到雲端')
      } catch (uploadErr: any) {
        console.error('[Video Save] Upload failed:', uploadErr)
        toastStore.warning('雲端儲存失敗，嘗試使用臨時連結...')

        // Fallback: save with external URL (may expire)
        try {
          await createVideo({
            user_id: userId,
            transcript: draft.value.transcript,
            video_url: videoResult.videoUrl,
            original_video_url: videoResult.videoUrl, // Same as video_url in fallback case
            audio_url: existingResult.audioUrl || null,
            aspect_ratio: draft.value.aspectRatio,
            status: 'completed',
            speaker_id: existingResult.speakerId || null,
            title: draft.value.title || null,
            avatar_preview: draft.value.avatarPreview || null,
            subtitle_style: draft.value.subtitleEnabled ? draft.value.subtitleFont : 'none',
            voice_preview: draft.value.voicePreview?.name || null,
          })
          console.log('[Video Save] Fallback: saved with external URL')
          toastStore.info('影片已儲存（使用臨時連結，可能會過期）')
        } catch (dbErr: any) {
          console.error('[Video Save] Database save failed:', dbErr)
          toastStore.error('影片儲存失敗')
        }
      }
    })()
  } catch (err: any) {
    console.error('Video generation failed:', err)
    generationStore.setError(err.message || '影片生成失敗')
    generationStore.setStage('error')
    toastStore.error('影片生成失敗', err.message)
  }
}
</script>

<template>
  <div class="card p-4 space-y-3">
    <!-- Compact settings row -->
    <div class="flex gap-2">
      <!-- Aspect Ratio Toggle -->
      <div class="flex-1 flex bg-stone-100 rounded-lg p-0.5">
        <button
          v-for="option in aspectRatioOptions"
          :key="option.value"
          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-all"
          :class="draft.aspectRatio === option.value
            ? 'bg-white text-stone-800 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'"
          @click="setAspectRatio(option.value)"
        >
          <component :is="option.icon" class="w-3.5 h-3.5" />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <!-- Video Model Toggle -->
      <div class="flex-1 flex bg-stone-100 rounded-lg p-0.5">
        <button
          v-for="option in videoModelOptions"
          :key="option.value"
          class="flex-1 py-1.5 px-2 text-sm rounded-md transition-all"
          :class="draft.videoModel === option.value
            ? 'bg-white text-stone-800 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'"
          @click="setVideoModel(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Disabled reason hint -->
    <p
      v-if="disabledReason && !isGenerating"
      class="text-xs text-amber-600 text-center"
    >
      {{ disabledReason }}
    </p>

    <!-- Show "Continue to video" if we have audio but no video -->
    <template v-if="generationStore.generatedResult?.audioUrl && !generationStore.generatedResult?.videoUrl">
      <button
        class="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        :disabled="isGenerating || !draft.avatarPreview"
        @click="handleContinueToVideo"
      >
        <svg v-if="isGenerating" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        繼續生成影片
      </button>
    </template>

    <!-- Normal generation buttons -->
    <div v-else class="flex gap-2">
      <!-- Voice only button -->
      <button
        class="flex-1 px-3 py-2 bg-stone-100 text-stone-700 font-medium rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        :disabled="!canGenerate"
        @click="handleGenerateVoiceOnly"
      >
        <svg v-if="isGenerating && stage === 'voice'" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        語音
        <span v-if="!isGenerating" class="flex items-center gap-0.5 text-stone-500">
          <Gem class="w-3 h-3" />{{ estimatedVoiceTokenCost }}
        </span>
      </button>

      <!-- Full video button -->
      <button
        class="flex-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        :disabled="!canGenerate"
        @click="handleGenerateVideo"
      >
        <svg v-if="isGenerating" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        影片
        <span v-if="!isGenerating" class="flex items-center gap-0.5 text-white/80">
          <Gem class="w-3 h-3" />{{ estimatedVideoTokenCost }}
        </span>
      </button>
    </div>
  </div>
</template>
