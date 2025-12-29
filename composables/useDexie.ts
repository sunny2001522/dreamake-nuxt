import Dexie, { type Table } from 'dexie'
import type { DbVideo } from '~/types'

/**
 * Extended DbVideo with cache metadata
 */
export interface CachedVideo extends DbVideo {
  _cachedAt: number
}

/**
 * Cache metadata for tracking sync status
 */
export interface CacheMeta {
  key: string
  userId: string
  lastSyncedAt: number
}

/**
 * Dreammake IndexedDB database using Dexie
 */
class DreammakeDB extends Dexie {
  videos!: Table<CachedVideo>
  cacheMeta!: Table<CacheMeta>

  constructor() {
    super('DreammakeDB')
    this.version(1).stores({
      videos: 'id, user_id, created_at, _cachedAt',
      cacheMeta: 'key',
    })
  }
}

// Singleton database instance
let db: DreammakeDB | null = null

/**
 * Composable for accessing Dexie IndexedDB
 * Only works on client-side
 */
export const useDexie = () => {
  const getDb = (): DreammakeDB | null => {
    // Only initialize on client-side
    if (import.meta.server) return null

    if (!db) {
      db = new DreammakeDB()
    }
    return db
  }

  return {
    db: getDb(),
  }
}
