import type { DbUserPreferences, SubtitleStyleType } from '~/types'

/**
 * Composable for managing user preferences in Supabase
 */
export const usePreferencesStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Get user preferences from Supabase
   */
  const getUserPreferences = async (userId: string): Promise<DbUserPreferences | null> => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // PGRST116 means no rows found - not an error, just no preferences yet
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch user preferences: ${error.message}`)
    }

    return data
  }

  /**
   * Upsert user preferences (insert or update)
   */
  const upsertUserPreferences = async (
    preferences: Partial<DbUserPreferences> & { user_id: string }
  ): Promise<DbUserPreferences> => {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(preferences, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to upsert user preferences: ${error.message}`)
    }

    return data
  }

  /**
   * Update persona preference
   */
  const updatePersonaPreference = async (
    userId: string,
    personaId: string | null
  ): Promise<void> => {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, persona_id: personaId },
        { onConflict: 'user_id' }
      )

    if (error) {
      // Ignore foreign key constraint errors
      if (error.message.includes('foreign key constraint') || error.code === '23503') {
        console.warn('Persona ID not found in Supabase, skipping preference sync')
        return
      }
      throw new Error(`Failed to update persona preference: ${error.message}`)
    }
  }

  /**
   * Update voice preference
   */
  const updateVoicePreference = async (
    userId: string,
    voiceId: string | null
  ): Promise<void> => {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, voice_id: voiceId },
        { onConflict: 'user_id' }
      )

    if (error) {
      // Ignore foreign key constraint errors (local-only voice)
      if (error.message.includes('foreign key constraint') || error.code === '23503') {
        console.warn('Voice ID not found in Supabase, skipping preference sync')
        return
      }
      throw new Error(`Failed to update voice preference: ${error.message}`)
    }
  }

  /**
   * Update image preference
   */
  const updateImagePreference = async (
    userId: string,
    imageId: string | null
  ): Promise<void> => {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, image_id: imageId },
        { onConflict: 'user_id' }
      )

    if (error) {
      // Ignore foreign key constraint errors (local-only image)
      if (error.message.includes('foreign key constraint') || error.code === '23503') {
        console.warn('Image ID not found in Supabase, skipping preference sync')
        return
      }
      throw new Error(`Failed to update image preference: ${error.message}`)
    }
  }

  /**
   * Update subtitle style preference
   */
  const updateSubtitleStylePreference = async (
    userId: string,
    subtitleStyle: SubtitleStyleType
  ): Promise<void> => {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, subtitle_style: subtitleStyle },
        { onConflict: 'user_id' }
      )

    if (error) {
      throw new Error(`Failed to update subtitle style: ${error.message}`)
    }
  }

  return {
    getUserPreferences,
    upsertUserPreferences,
    updatePersonaPreference,
    updateVoicePreference,
    updateImagePreference,
    updateSubtitleStylePreference,
  }
}
