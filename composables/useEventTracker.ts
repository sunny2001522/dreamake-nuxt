/**
 * 埋點追蹤 Composable
 * 將事件即時發送到 Google Sheets
 */
export const useEventTracker = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  const track = async (eventName: string) => {
    const webhookUrl = config.public.googleSheetsWebhook
    if (!webhookUrl) {
      console.warn('[EventTracker] No webhook URL configured')
      return
    }

    try {
      await $fetch(webhookUrl, {
        method: 'POST',
        body: {
          user_id: authStore.user?.id || authStore.authInfo?.email || null,
          event_name: eventName,
        },
      })
    } catch (e) {
      // 靜默失敗，不影響用戶體驗
      console.error('[EventTracker]', e)
    }
  }

  return { track }
}
