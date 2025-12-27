import type { DbPersona, DbPersonaInsert, DbPersonaUpdate } from '~/types'

/**
 * Composable for managing persona storage in Supabase
 */
export const usePersonaStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Get all personas for a user, sorted by last_used_at (most recent first)
   */
  const getAllPersonas = async (userId: string): Promise<DbPersona[]> => {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch personas: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a persona by ID
   */
  const getPersonaById = async (id: string): Promise<DbPersona | null> => {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      // PGRST116 means no rows found - not an error, just no persona
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch persona: ${error.message}`)
    }

    return data
  }

  /**
   * Save a new persona to Supabase
   */
  const savePersona = async (
    persona: DbPersonaInsert,
    userId: string
  ): Promise<DbPersona> => {
    const personaData: DbPersonaInsert = {
      ...persona,
      user_id: userId,
    }

    const { data, error } = await supabase
      .from('personas')
      .insert(personaData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save persona: ${error.message}`)
    }

    return data
  }

  /**
   * Record persona usage (update last_used_at and increment use_count)
   */
  const recordPersonaUsage = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('record_persona_usage', { persona_id: id })

    if (error) {
      // Fallback to manual update if RPC fails
      await supabase
        .from('personas')
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq('id', id)
    }
  }

  /**
   * Update persona metadata
   */
  const updatePersona = async (
    id: string,
    updates: DbPersonaUpdate
  ): Promise<DbPersona | null> => {
    const { data, error } = await supabase
      .from('personas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update persona: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a persona
   */
  const deletePersona = async (id: string): Promise<void> => {
    const { error } = await supabase.from('personas').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete persona: ${error.message}`)
    }
  }

  return {
    getAllPersonas,
    getPersonaById,
    savePersona,
    recordPersonaUsage,
    updatePersona,
    deletePersona,
  }
}
