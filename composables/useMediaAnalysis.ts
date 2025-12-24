interface MediaItem {
  url: string
  limit?: number
}

interface AnalysisProgress {
  total: number
  completed: number
  current_platform?: string
}

export function useMediaAnalysis() {
  const isAnalyzing = ref(false)
  const error = ref<string | null>(null)
  const progress = ref<AnalysisProgress | null>(null)
  const result = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)

  async function startAnalysis(items: MediaItem[]): Promise<{ jobId: string }> {
    try {
      isAnalyzing.value = true
      error.value = null
      progress.value = { total: items.length, completed: 0 }
      abortController.value = new AbortController()

      const response = await $fetch('/api/media/analyze', {
        method: 'POST',
        body: { items },
      })

      return { jobId: (response as any).job_id }
    } catch (err: any) {
      error.value = err.message || 'Failed to start analysis'
      isAnalyzing.value = false
      throw err
    }
  }

  async function pollStatus(jobId: string): Promise<{
    status: string
    result?: string
    progress?: AnalysisProgress
  }> {
    const response = await $fetch('/api/media/status', {
      params: { job_id: jobId },
    })

    const data = response as any
    return {
      status: data.status,
      result: data.result,
      progress: data.progress,
    }
  }

  async function pollUntilComplete(
    jobId: string,
    options: {
      onProgress?: (progress: AnalysisProgress) => void
      maxAttempts?: number
      intervalMs?: number
    } = {}
  ): Promise<string> {
    const { maxAttempts = 180, intervalMs = 2000, onProgress } = options

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check if aborted
      if (abortController.value?.signal.aborted) {
        throw new Error('Analysis cancelled')
      }

      const status = await pollStatus(jobId)

      if (status.progress) {
        progress.value = status.progress
        onProgress?.(status.progress)
      }

      if (status.status === 'completed' && status.result) {
        result.value = status.result
        isAnalyzing.value = false
        return status.result
      }

      if (status.status === 'error') {
        throw new Error('Analysis failed')
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Analysis timed out')
  }

  function cancel() {
    abortController.value?.abort()
    isAnalyzing.value = false
    progress.value = null
  }

  function reset() {
    isAnalyzing.value = false
    error.value = null
    progress.value = null
    result.value = null
    abortController.value = null
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    error: readonly(error),
    progress: readonly(progress),
    result: readonly(result),

    // Methods
    startAnalysis,
    pollStatus,
    pollUntilComplete,
    cancel,
    reset,
  }
}
