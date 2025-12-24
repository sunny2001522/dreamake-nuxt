import type { VideoModel, WaveSpeedResolution, GenerationRecord } from '~/types'

interface GenerateVideoParams {
  transcript: string
  speakerId: string
  avatarUrl: string
  aspectRatio: 'portrait' | 'landscape'
  videoModel?: VideoModel
  waveSpeedPrompt?: string
  waveSpeedResolution?: WaveSpeedResolution
}

interface PollResult {
  status: 'pending' | 'generating' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

export function useVideoGeneration() {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const generationStage = ref<'idle' | 'cloning' | 'voice' | 'subtitle' | 'video' | 'complete'>('idle')
  const generatedResult = ref<GenerationRecord | null>(null)
  const stepDurations = ref<Record<string, number>>({})

  const stepStartTime = ref<number | null>(null)

  function startStep() {
    stepStartTime.value = Date.now()
  }

  function recordStepDuration(stepKey: string) {
    if (stepStartTime.value) {
      const duration = (Date.now() - stepStartTime.value) / 1000
      stepDurations.value[stepKey] = duration
      stepStartTime.value = null
    }
  }

  async function generateVoice(speakerId: string, transcript: string): Promise<{ audioUrl: string }> {
    const response = await $fetch('/api/voice/tts', {
      method: 'POST',
      body: { speakerId, transcript },
    })
    return { audioUrl: (response as any).audioUrl }
  }

  async function startGeneration(params: GenerateVideoParams) {
    try {
      isGenerating.value = true
      error.value = null
      generationStage.value = 'voice'
      stepDurations.value = {}

      const response = await $fetch('/api/generate', {
        method: 'POST',
        body: {
          transcript: params.transcript,
          speakerId: params.speakerId,
          avatarUrl: params.avatarUrl,
          aspectRatio: params.aspectRatio,
          videoModel: params.videoModel || 'vidnoz',
          waveSpeedPrompt: params.waveSpeedPrompt,
          waveSpeedResolution: params.waveSpeedResolution,
        },
      })

      const result = response as any
      generationStage.value = 'video'

      return {
        taskId: result.taskId,
        pollEndpoint: result.pollEndpoint as 'vidnoz' | 'wavespeed',
        audioUrl: result.audioUrl,
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to start generation'
      generationStage.value = 'idle'
      throw err
    }
  }

  async function pollVideoStatus(
    taskId: string,
    endpoint: 'vidnoz' | 'wavespeed'
  ): Promise<PollResult> {
    try {
      let url: string
      if (endpoint === 'wavespeed') {
        url = `/api/video/wavespeed/${taskId}`
      } else {
        url = `/api/video/${taskId}`
      }

      const response = await $fetch(url)
      const data = response as any

      return {
        status: data.status,
        videoUrl: data.videoUrl,
        error: data.error,
      }
    } catch (err: any) {
      return {
        status: 'failed',
        error: err.message,
      }
    }
  }

  async function pollUntilComplete(
    taskId: string,
    endpoint: 'vidnoz' | 'wavespeed',
    options: {
      onStatusChange?: (status: string) => void
      maxAttempts?: number
      intervalMs?: number
    } = {}
  ): Promise<{ videoUrl: string }> {
    const { maxAttempts = 120, intervalMs = 3000, onStatusChange } = options

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await pollVideoStatus(taskId, endpoint)

      onStatusChange?.(result.status)

      if (result.status === 'completed' && result.videoUrl) {
        return { videoUrl: result.videoUrl }
      }

      if (result.status === 'failed') {
        throw new Error(result.error || 'Video generation failed')
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Video generation timed out')
  }

  function reset() {
    isGenerating.value = false
    error.value = null
    generationStage.value = 'idle'
    generatedResult.value = null
    stepDurations.value = {}
  }

  function complete(result: GenerationRecord) {
    generatedResult.value = result
    generationStage.value = 'complete'
    isGenerating.value = false
  }

  return {
    // State
    isGenerating: readonly(isGenerating),
    error: readonly(error),
    generationStage: readonly(generationStage),
    generatedResult: readonly(generatedResult),
    stepDurations: readonly(stepDurations),

    // Methods
    generateVoice,
    startGeneration,
    pollVideoStatus,
    pollUntilComplete,
    startStep,
    recordStepDuration,
    reset,
    complete,
  }
}
