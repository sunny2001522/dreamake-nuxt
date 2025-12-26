import type { DbVideo, DbVideoInsert, DbVideoUpdate } from '~/types'

/**
 * Composable for managing video storage in Supabase
 */
export const useVideoStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Get all videos for a user, sorted by created_at (most recent first)
   */
  const getAllVideos = async (userId: string): Promise<DbVideo[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a video by ID
   */
  const getVideoById = async (id: string): Promise<DbVideo | null> => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return null
    }

    return data
  }

  /**
   * Get videos by status
   */
  const getVideosByStatus = async (
    userId: string,
    status: 'processing' | 'completed' | 'failed'
  ): Promise<DbVideo[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`)
    }

    return data || []
  }

  /**
   * Create a new video record
   */
  const createVideo = async (
    video: DbVideoInsert
  ): Promise<DbVideo> => {
    const { data, error } = await supabase
      .from('videos')
      .insert(video)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create video: ${error.message}`)
    }

    return data
  }

  /**
   * Update a video record
   */
  const updateVideo = async (
    id: string,
    updates: DbVideoUpdate
  ): Promise<DbVideo | null> => {
    const { data, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update video: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a video record
   */
  const deleteVideo = async (id: string): Promise<void> => {
    const { error } = await supabase.from('videos').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete video: ${error.message}`)
    }
  }

  return {
    getAllVideos,
    getVideoById,
    getVideosByStatus,
    createVideo,
    updateVideo,
    deleteVideo,
  }
}
