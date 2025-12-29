import type { DbUserPreferences, SubtitleStyleType } from '~/types'

/**
 * Composable for managing user preferences in Supabase
 * Uses server-side API to bypass RLS for CMoney OIDC users
 */
export const usePreferencesStorage = () => {
  /**
   * Get user preferences from Supabase
   * Uses server API to bypass RLS
   */
  const getUserPreferences = async (userId: string): Promise<DbUserPreferences | null> => {
    try {
      const data = await $fetch<DbUserPreferences | null>('/api/preferences', {
        query: { userId },
      })
      return data
    } catch (error: any) {
      // Handle 404 or empty response as null
      if (error.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Upsert user preferences (insert or update)
   * Uses server API to bypass RLS
   */
  const upsertUserPreferences = async (
    preferences: Partial<DbUserPreferences> & { user_id: string }
  ): Promise<DbUserPreferences> => {
    const data = await $fetch<DbUserPreferences>('/api/preferences', {
      method: 'POST',
      body: preferences,
    })
    return data
  }

  /**
   * Update persona preference
   * Uses server API to bypass RLS
   */
  const updatePersonaPreference = async (
    userId: string,
    personaId: string | null
  ): Promise<void> => {
    try {
      await $fetch('/api/preferences', {
        method: 'POST',
        body: { user_id: userId, persona_id: personaId },
      })
    } catch (error: any) {
      // Ignore foreign key constraint errors
      if (error.data?.warning) {
        console.warn('Persona ID not found in Supabase, skipping preference sync')
        return
      }
      throw error
    }
  }

  /**
   * Update voice preference
   * Uses server API to bypass RLS
   */
  const updateVoicePreference = async (
    userId: string,
    voiceId: string | null
  ): Promise<void> => {
    try {
      await $fetch('/api/preferences', {
        method: 'POST',
        body: { user_id: userId, voice_id: voiceId },
      })
    } catch (error: any) {
      // Ignore foreign key constraint errors (local-only voice)
      if (error.data?.warning) {
        console.warn('Voice ID not found in Supabase, skipping preference sync')
        return
      }
      throw error
    }
  }

  /**
   * Update image preference
   * Uses server API to bypass RLS
   */
  const updateImagePreference = async (
    userId: string,
    imageId: string | null
  ): Promise<void> => {
    try {
      await $fetch('/api/preferences', {
        method: 'POST',
        body: { user_id: userId, image_id: imageId },
      })
    } catch (error: any) {
      // Ignore foreign key constraint errors (local-only image)
      if (error.data?.warning) {
        console.warn('Image ID not found in Supabase, skipping preference sync')
        return
      }
      throw error
    }
  }

  /**
   * Update subtitle style preference
   * Uses server API to bypass RLS
   */
  const updateSubtitleStylePreference = async (
    userId: string,
    subtitleStyle: SubtitleStyleType
  ): Promise<void> => {
    await $fetch('/api/preferences', {
      method: 'POST',
      body: { user_id: userId, subtitle_style: subtitleStyle },
    })
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
