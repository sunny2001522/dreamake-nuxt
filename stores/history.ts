import type { DbVideo } from '~/types'

/**
 * Store for managing history videos with IndexedDB cache
 * Uses Stale-While-Revalidate (SWR) strategy
 */
export const useHistoryStore = defineStore('history', () => {
  // State
  const videos = ref<DbVideo[]>([])
  const isLoading = ref(false)
  const isRevalidating = ref(false)
  const isInitialized = ref(false)

  /**
   * Load videos with SWR strategy
   * 1. Try to load from IndexedDB cache first
   * 2. If cache exists, show it immediately
   * 3. If cache is stale, revalidate in background
   */
  async function loadVideos(userId: string): Promise<void> {
    const { getCachedVideos, revalidateVideos } = useVideoCache()

    // If already loading, skip
    if (isLoading.value) return

    isLoading.value = true

    try {
      const result = await getCachedVideos(userId)
      videos.value = result.videos
      isInitialized.value = true

      // If cache is stale, revalidate in background
      if (result.isStale && result.isFromCache) {
        isRevalidating.value = true
        revalidateVideos(userId)
          .then((freshVideos) => {
            videos.value = freshVideos
          })
          .catch((error) => {
            console.warn('Background revalidation failed:', error)
          })
          .finally(() => {
            isRevalidating.value = false
          })
      }
    } catch (error) {
      console.error('Failed to load videos:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Force refresh videos from Supabase
   */
  async function refreshVideos(userId: string): Promise<void> {
    const { revalidateVideos } = useVideoCache()

    isRevalidating.value = true
    try {
      const freshVideos = await revalidateVideos(userId)
      videos.value = freshVideos
    } finally {
      isRevalidating.value = false
    }
  }

  /**
   * Add a new video to the store and cache
   */
  async function addVideo(video: DbVideo): Promise<void> {
    const { addVideoToCache } = useVideoCache()

    // Add to cache
    await addVideoToCache(video)

    // Add to state (prepend to show newest first)
    videos.value = [video, ...videos.value]
  }

  /**
   * Remove a video from the store and cache
   */
  async function removeVideo(videoId: string): Promise<void> {
    const { removeVideoFromCache } = useVideoCache()

    // Remove from cache
    await removeVideoFromCache(videoId)

    // Remove from state
    videos.value = videos.value.filter(v => v.id !== videoId)
  }

  /**
   * Clear all cache (for logout)
   */
  async function clearCache(): Promise<void> {
    const { clearAllCache } = useVideoCache()

    await clearAllCache()
    videos.value = []
    isInitialized.value = false
  }

  /**
   * Reset store state
   */
  function $reset(): void {
    videos.value = []
    isLoading.value = false
    isRevalidating.value = false
    isInitialized.value = false
  }

  return {
    // State
    videos,
    isLoading,
    isRevalidating,
    isInitialized,

    // Actions
    loadVideos,
    refreshVideos,
    addVideo,
    removeVideo,
    clearCache,
    $reset,
  }
})
