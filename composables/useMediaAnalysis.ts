import type { MediaPlatform, PendingAnalysis } from '~/types'

interface MediaItem {
  url: string
  platform: MediaPlatform
  type: string
  limit?: number
  isValid: boolean
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

  const authStore = useAuthStore()
  const pendingStore = usePendingAnalysesStore()

  /**
   * 啟動分析任務並存入數據庫
   * 輪詢由全局 store 處理
   */
  async function startAnalysis(items: MediaItem[]): Promise<{ jobId: string; pendingId: string }> {
    if (!authStore.user) {
      throw new Error('User not authenticated')
    }

    // 使用 OIDC 用戶 ID
    const userId = authStore.authInfo.email || authStore.authInfo.sub

    try {
      isAnalyzing.value = true
      error.value = null
      progress.value = { total: items.length, completed: 0 }

      // 1. 調用後端 API 啟動分析
      const response = await $fetch('/api/media/analyze', {
        method: 'POST',
        body: { items },
      })

      const jobId = (response as any).job_id

      // 2. 將任務存入數據庫
      const supabase = useSupabaseClient<any>()
      const { data: pendingData, error: insertError } = await supabase
        .from('pending_analyses')
        .insert({
          user_id: userId,
          job_id: jobId,
          source_urls: items.map(i => i.url),
          platforms: items.map(i => i.platform),
          status: 'pending',
        })
        .select()
        .single()

      if (insertError || !pendingData) {
        console.error('[MediaAnalysis] Failed to save pending analysis:', insertError)
        throw new Error('Failed to save analysis task')
      }

      // 3. 添加到全局 store（啟動背景輪詢）
      const pendingAnalysis: PendingAnalysis = {
        id: pendingData.id,
        jobId: pendingData.job_id,
        sourceUrls: pendingData.source_urls,
        platforms: pendingData.platforms as MediaPlatform[],
        status: 'pending',
        createdAt: new Date(pendingData.created_at),
        updatedAt: new Date(pendingData.updated_at),
        pollCount: 0,
      }

      pendingStore.addAnalysis(pendingAnalysis)

      // 分析已在背景進行，前端不需要等待
      isAnalyzing.value = false

      return { jobId, pendingId: pendingData.id }
    }
    catch (err: any) {
      error.value = err.message || 'Failed to start analysis'
      isAnalyzing.value = false
      throw err
    }
  }

  /**
   * 查詢單個任務狀態（供內部使用）
   */
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

  /**
   * 取消分析（從 store 移除）
   */
  function cancel(jobId?: string) {
    if (jobId) {
      pendingStore.removeAnalysis(jobId)
    }
    isAnalyzing.value = false
    progress.value = null
  }

  /**
   * 重置狀態
   */
  function reset() {
    isAnalyzing.value = false
    error.value = null
    progress.value = null
    result.value = null
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
    cancel,
    reset,
  }
}
