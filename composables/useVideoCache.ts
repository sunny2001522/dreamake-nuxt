import type { DbVideo } from '~/types'
import { useDexie, type CachedVideo } from './useDexie'

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_KEY_PREFIX = 'videos'

/**
 * Check if cache is stale based on lastSyncedAt timestamp
 */
function isCacheStale(lastSyncedAt: number): boolean {
  return Date.now() - lastSyncedAt > CACHE_TTL_MS
}

/**
 * Composable for managing video cache with Stale-While-Revalidate strategy
 */
export const useVideoCache = () => {
  const { db } = useDexie()
  const { getAllVideos: fetchFromSupabase } = useVideoStorage()

  /**
   * Get cached videos for a user
   * Returns cached data immediately and indicates if revalidation is needed
   */
  async function getCachedVideos(userId: string): Promise<{
    videos: DbVideo[]
    isFromCache: boolean
    isStale: boolean
  }> {
    // SSR fallback - fetch directly from Supabase
    if (!db) {
      const videos = await fetchFromSupabase(userId)
      return { videos, isFromCache: false, isStale: false }
    }

    try {
      // Check cache metadata
      const cacheKey = `${CACHE_KEY_PREFIX}:${userId}`
      const meta = await db.cacheMeta.get(cacheKey)

      // Get cached videos for this user
      const cached = await db.videos
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('created_at')

      // Determine if cache is stale
      const isStale = !meta || isCacheStale(meta.lastSyncedAt)

      if (cached.length > 0) {
        // Return cached data, let caller decide whether to revalidate
        return {
          videos: cached,
          isFromCache: true,
          isStale,
        }
      }

      // No cache - fetch from Supabase
      const videos = await fetchFromSupabase(userId)
      await cacheVideos(userId, videos)
      return { videos, isFromCache: false, isStale: false }
    } catch (error) {
      console.error('Cache read failed, fetching from Supabase:', error)
      const videos = await fetchFromSupabase(userId)
      return { videos, isFromCache: false, isStale: false }
    }
  }

  /**
   * Revalidate cache by fetching fresh data from Supabase
   */
  async function revalidateVideos(userId: string): Promise<DbVideo[]> {
    const videos = await fetchFromSupabase(userId)
    await cacheVideos(userId, videos)
    return videos
  }

  /**
   * Write videos to cache
   */
  async function cacheVideos(userId: string, videos: DbVideo[]): Promise<void> {
    if (!db) return

    try {
      const now = Date.now()
      const cacheKey = `${CACHE_KEY_PREFIX}:${userId}`

      // Clear old cache for this user
      await db.videos.where('user_id').equals(userId).delete()

      // Write new data with cache timestamp
      const cachedVideos: CachedVideo[] = videos.map(v => ({
        ...v,
        _cachedAt: now,
      }))
      await db.videos.bulkPut(cachedVideos)

      // Update cache metadata
      await db.cacheMeta.put({
        key: cacheKey,
        userId,
        lastSyncedAt: now,
      })
    } catch (error) {
      console.error('Cache write failed:', error)
    }
  }

  /**
   * Add a single video to cache
   */
  async function addVideoToCache(video: DbVideo): Promise<void> {
    if (!db) return

    try {
      const cachedVideo: CachedVideo = {
        ...video,
        _cachedAt: Date.now(),
      }
      await db.videos.put(cachedVideo)
    } catch (error) {
      console.error('Failed to add video to cache:', error)
    }
  }

  /**
   * Remove a video from cache
   */
  async function removeVideoFromCache(videoId: string): Promise<void> {
    if (!db) return

    try {
      await db.videos.delete(videoId)
    } catch (error) {
      console.error('Failed to remove video from cache:', error)
    }
  }

  /**
   * Clear all cache for a user
   */
  async function clearUserCache(userId: string): Promise<void> {
    if (!db) return

    try {
      const cacheKey = `${CACHE_KEY_PREFIX}:${userId}`
      await db.videos.where('user_id').equals(userId).delete()
      await db.cacheMeta.delete(cacheKey)
    } catch (error) {
      console.error('Failed to clear user cache:', error)
    }
  }

  /**
   * Clear all cache (for logout)
   */
  async function clearAllCache(): Promise<void> {
    if (!db) return

    try {
      await db.videos.clear()
      await db.cacheMeta.clear()
    } catch (error) {
      console.error('Failed to clear all cache:', error)
    }
  }

  return {
    getCachedVideos,
    revalidateVideos,
    cacheVideos,
    addVideoToCache,
    removeVideoFromCache,
    clearUserCache,
    clearAllCache,
  }
}
