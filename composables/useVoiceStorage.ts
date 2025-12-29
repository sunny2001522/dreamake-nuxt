import type { DbVoice, DbVoiceInsert, DbVoiceUpdate } from '~/types'

/**
 * Composable for managing voice storage in Supabase
 * Uses server-side API to bypass RLS for CMoney OIDC users
 */
export const useVoiceStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Get all voices for a user, sorted by last_used_at (most recent first)
   * Uses server API to bypass RLS
   */
  const getAllVoices = async (userId: string): Promise<DbVoice[]> => {
    const data = await $fetch<DbVoice[]>('/api/voices', {
      query: { userId },
    })

    return data || []
  }

  /**
   * Get a voice by ID
   */
  const getVoiceById = async (id: string): Promise<DbVoice | null> => {
    const { data, error } = await supabase
      .from('voices')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return null
    }

    return data
  }

  /**
   * Get a voice by speaker ID
   */
  const getVoiceBySpeakerId = async (
    speakerId: string,
    userId: string
  ): Promise<DbVoice | null> => {
    const { data, error } = await supabase
      .from('voices')
      .select('*')
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)
      .single()

    if (error) {
      return null
    }

    return data
  }

  /**
   * Save a new voice to Supabase
   */
  const saveVoice = async (
    voice: {
      name: string
      speakerId?: string
      originalFileName: string
      audioFile?: File
      audioMimeType?: string
    },
    userId: string
  ): Promise<DbVoice> => {
    let audioUrl: string | null = null

    // Only upload audio file if no speakerId and file exists
    if (voice.audioFile && !voice.speakerId) {
      const timestamp = Date.now()
      const ext = voice.originalFileName.split('.').pop() || 'webm'
      const filePath = `${userId}/${timestamp}.${ext}`

      try {
        const { error: uploadError } = await supabase.storage
          .from('voices')
          .upload(filePath, voice.audioFile, { upsert: true })

        if (uploadError) {
          console.warn(`Storage upload failed: ${uploadError.message}`)
        } else {
          const { data: urlData } = supabase.storage
            .from('voices')
            .getPublicUrl(filePath)
          audioUrl = urlData.publicUrl
        }
      } catch (err) {
        console.warn('Storage upload exception:', err)
      }
    }

    // Insert metadata to database
    const voiceData: DbVoiceInsert = {
      user_id: userId,
      name: voice.name,
      speaker_id: voice.speakerId || '',
      original_file_name: voice.originalFileName,
      audio_url: audioUrl,
      audio_mime_type: voice.audioMimeType || null,
    }

    const { data, error } = await supabase
      .from('voices')
      .insert(voiceData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save voice metadata: ${error.message}`)
    }

    return data
  }

  /**
   * Record voice usage (update last_used_at)
   */
  const recordVoiceUsage = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('record_voice_usage', { voice_id: id })

    if (error) {
      // Fallback to manual update if RPC fails
      await supabase
        .from('voices')
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq('id', id)
    }
  }

  /**
   * Update voice metadata
   */
  const updateVoice = async (
    id: string,
    updates: DbVoiceUpdate
  ): Promise<DbVoice | null> => {
    const { data, error } = await supabase
      .from('voices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update voice: ${error.message}`)
    }

    return data
  }

  /**
   * Update speaker_id after voice cloning
   */
  const updateVoiceSpeakerId = async (
    id: string,
    speakerId: string
  ): Promise<void> => {
    const { error } = await supabase
      .from('voices')
      .update({ speaker_id: speakerId })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update speaker ID: ${error.message}`)
    }
  }

  /**
   * Delete a voice (both from Storage and database)
   * Uses server API to bypass RLS
   */
  const deleteVoice = async (id: string): Promise<void> => {
    await $fetch(`/api/voices/${id}`, {
      method: 'DELETE',
    })
  }

  return {
    getAllVoices,
    getVoiceById,
    getVoiceBySpeakerId,
    saveVoice,
    recordVoiceUsage,
    updateVoice,
    updateVoiceSpeakerId,
    deleteVoice,
  }
}
