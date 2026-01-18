import type { DbVideo, DbVideoInsert, DbVideoUpdate } from '~/types'

/**
 * Composable for managing video storage in Supabase
 */
export const useVideoStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Upload video from external URL to Supabase Storage
   * This creates a permanent URL that won't expire
   * Uses server-side API with admin client to bypass RLS for CMoney OIDC users
   */
  const uploadVideoToStorage = async (
    externalUrl: string,
    userId: string
  ): Promise<string> => {
    // Use server-side API to upload (bypasses RLS)
    const result = await $fetch('/api/video/upload', {
      method: 'POST',
      body: { externalUrl, userId },
    })

    return result.publicUrl
  }

  /**
   * Upload burned video blob to Supabase Storage
   * Used for uploading videos with burned-in subtitles
   * Uses server-side API with admin client to bypass RLS for CMoney OIDC users
   */
  const uploadBlobToStorage = async (blob: Blob, userId: string): Promise<string> => {
    const formData = new FormData()
    formData.append('file', blob, `burned-${Date.now()}.mp4`)
    formData.append('userId', userId)

    const result = await $fetch('/api/video/upload-blob', {
      method: 'POST',
      body: formData,
    })

    return result.publicUrl
  }

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
    uploadVideoToStorage,
    uploadBlobToStorage,
    getAllVideos,
    getVideoById,
    getVideosByStatus,
    createVideo,
    updateVideo,
    deleteVideo,
  }
}
