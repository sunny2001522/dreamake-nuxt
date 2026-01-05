/**
 * 全局背景分析輪詢 Plugin
 *
 * 在用戶登入後自動加載 pending 分析任務並啟動背景輪詢
 */
export default defineNuxtPlugin(() => {
  const user = useSupabaseUser()
  const pendingStore = usePendingAnalysesStore()

  // 監聽用戶登入狀態
  watch(
    user,
    async (currentUser, previousUser) => {
      if (currentUser?.id) {
        // 用戶登入後，加載 pending 分析
        await pendingStore.loadPendingAnalyses(currentUser.id)
      }
      else if (previousUser?.id && !currentUser) {
        // 用戶登出，清除狀態
        pendingStore.clear()
      }
    },
    { immediate: true }
  )

  // 頁面可見性變化時，立即觸發一次輪詢
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && pendingStore.hasPending) {
        // 頁面恢復可見時，立即輪詢一次
        pendingStore.pollAllPending()
      }
    })
  }
})
