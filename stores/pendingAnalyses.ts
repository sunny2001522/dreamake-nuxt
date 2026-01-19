import type { PendingAnalysis, PollPendingResponse } from '~/types'

const POLL_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

export const usePendingAnalysesStore = defineStore('pendingAnalyses', () => {
  const analyses = ref<PendingAnalysis[]>([])
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
  const isPolling = ref(false)
  const lastPollTime = ref<Date | null>(null)

  const toastStore = useToastStore()

  // Check if there are any pending analyses
  const hasPending = computed(() =>
    analyses.value.some(a => a.status === 'pending' || a.status === 'processing')
  )

  const pendingCount = computed(() =>
    analyses.value.filter(a => a.status === 'pending' || a.status === 'processing').length
  )

  // Add a new analysis to track
  function addAnalysis(analysis: PendingAnalysis) {
    // Avoid duplicates
    const existing = analyses.value.find(a => a.jobId === analysis.jobId)
    if (!existing) {
      analyses.value.push(analysis)
      ensurePolling()
    }
  }

  // Remove an analysis (when completed or failed)
  function removeAnalysis(jobId: string) {
    analyses.value = analyses.value.filter(a => a.jobId !== jobId)
    if (!hasPending.value) {
      stopPolling()
    }
  }

  // Update an analysis status
  function updateAnalysis(jobId: string, updates: Partial<PendingAnalysis>) {
    const index = analyses.value.findIndex(a => a.jobId === jobId)
    if (index !== -1) {
      analyses.value[index] = { ...analyses.value[index], ...updates }
    }
  }

  // Start polling if not already running
  function ensurePolling() {
    if (!pollTimer.value && hasPending.value) {
      // Poll immediately first
      pollAllPending()
      // Then set up interval
      pollTimer.value = setInterval(pollAllPending, POLL_INTERVAL_MS)
    }
  }

  // Stop polling
  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
    isPolling.value = false
  }

  // Poll all pending analyses
  async function pollAllPending() {
    if (isPolling.value || !hasPending.value) return

    // 獲取當前用戶 ID (使用 OIDC authStore，非 Supabase)
    const authStore = useAuthStore()
    const userId = authStore.authInfo?.email || authStore.authInfo?.sub
    if (!userId) {
      console.warn('[PendingAnalyses] No user logged in, skipping poll')
      return
    }

    try {
      isPolling.value = true
      lastPollTime.value = new Date()

      const response = await $fetch<PollPendingResponse>('/api/media/poll-pending', {
        method: 'POST',
        body: { user_id: userId },
      })

      // Handle completed analyses
      for (const completed of response.completed) {
        updateAnalysis(completed.jobId, {
          status: 'completed',
          result: completed.result,
          personaId: completed.personaId,
        })

        // Show success notification
        toastStore.success(`頻道分析完成！已自動儲存為創作風格`)

        // Remove from tracking after a short delay
        setTimeout(() => removeAnalysis(completed.jobId), 1000)
      }

      // Handle failed analyses
      for (const failed of response.failed) {
        updateAnalysis(failed.jobId, {
          status: 'failed',
          errorMessage: failed.errorMessage,
        })

        // Show error notification
        toastStore.error(`頻道分析失敗: ${failed.errorMessage}`)

        // Remove from tracking after a short delay
        setTimeout(() => removeAnalysis(failed.jobId), 1000)
      }

      // Update all analyses with latest status
      for (const analysis of response.analyses) {
        updateAnalysis(analysis.jobId, {
          status: analysis.status,
          pollCount: analysis.pollCount,
          lastPolledAt: analysis.lastPolledAt,
        })
      }
    }
    catch (error: any) {
      console.error('[PendingAnalyses] Poll failed:', error)
    }
    finally {
      isPolling.value = false
    }
  }

  // Load pending analyses from server (called on app init)
  async function loadPendingAnalyses(userId: string) {
    try {
      const data = await $fetch<PendingAnalysis[]>('/api/media/pending-list', {
        params: { user_id: userId },
      })

      if (data && data.length > 0) {
        // Add all pending analyses to store
        for (const analysis of data) {
          addAnalysis(analysis)
        }

        toastStore.info(`有 ${data.length} 個頻道分析正在進行中`)
      }
    }
    catch (error: any) {
      console.error('[PendingAnalyses] Failed to load pending analyses:', error)
    }
  }

  // Cancel an analysis (call API and remove from store)
  async function cancelAnalysis(jobId: string) {
    const authStore = useAuthStore()
    const userId = authStore.authInfo?.email || authStore.authInfo?.sub

    if (!userId) {
      console.warn('[PendingAnalyses] No user logged in, cannot cancel')
      return
    }

    try {
      await $fetch('/api/media/cancel', {
        method: 'POST',
        body: { job_id: jobId, user_id: userId },
      })

      // Remove from store
      removeAnalysis(jobId)
      toastStore.info('分析已取消')
    }
    catch (error: any) {
      console.error('[PendingAnalyses] Cancel failed:', error)
      toastStore.error('取消失敗', error.message || '請稍後再試')
    }
  }

  // Clear all and stop polling
  function clear() {
    stopPolling()
    analyses.value = []
  }

  return {
    // State
    analyses: readonly(analyses),
    isPolling: readonly(isPolling),
    lastPollTime: readonly(lastPollTime),
    hasPending,
    pendingCount,

    // Actions
    addAnalysis,
    removeAnalysis,
    updateAnalysis,
    cancelAnalysis,
    ensurePolling,
    stopPolling,
    pollAllPending,
    loadPendingAnalyses,
    clear,
  }
})
