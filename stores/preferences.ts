import type { DbUserPreferences, SubtitleStyleType } from '~/types'

export const usePreferencesStore = defineStore('preferences', () => {
  const supabase = useSupabaseClient()

  const preferences = ref<DbUserPreferences | null>(null)
  const isLoading = ref(false)

  // Load preferences from Supabase
  async function loadPreferences(userId: string) {
    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      preferences.value = data
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Set persona preference
  async function setPersonaPreference(userId: string, personaId: string | null) {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          persona_id: personaId,
        })

      if (error) throw error

      if (preferences.value) {
        preferences.value.persona_id = personaId
      }
    } catch (error) {
      console.error('Failed to set persona preference:', error)
      throw error
    }
  }

  // Set voice preference
  async function setVoicePreference(userId: string, voiceId: string | null) {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          voice_id: voiceId,
        })

      if (error) throw error

      if (preferences.value) {
        preferences.value.voice_id = voiceId
      }
    } catch (error) {
      console.error('Failed to set voice preference:', error)
      throw error
    }
  }

  // Set image preference
  async function setImagePreference(userId: string, imageId: string | null) {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          image_id: imageId,
        })

      if (error) throw error

      if (preferences.value) {
        preferences.value.image_id = imageId
      }
    } catch (error) {
      console.error('Failed to set image preference:', error)
      throw error
    }
  }

  // Set subtitle style preference
  async function setSubtitleStylePreference(userId: string, subtitleStyle: SubtitleStyleType) {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          subtitle_style: subtitleStyle,
        })

      if (error) throw error

      if (preferences.value) {
        preferences.value.subtitle_style = subtitleStyle
      }
    } catch (error) {
      console.error('Failed to set subtitle style preference:', error)
      throw error
    }
  }

  // Refresh preferences
  async function refreshPreferences(userId: string) {
    await loadPreferences(userId)
  }

  return {
    preferences,
    isLoading,
    loadPreferences,
    setPersonaPreference,
    setVoicePreference,
    setImagePreference,
    setSubtitleStylePreference,
    refreshPreferences,
  }
})
