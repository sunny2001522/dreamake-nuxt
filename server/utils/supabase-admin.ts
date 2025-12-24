import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabaseAdmin: SupabaseClient | null = null

/**
 * Get Supabase admin client with Service Role Key.
 * This client bypasses RLS and should only be used in server-side API routes.
 *
 * Use cases:
 * - Uploading to temp folders that don't follow user-namespaced paths
 * - Admin operations that need to bypass row-level security
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl
    const supabaseServiceRoleKey = config.supabaseServiceRoleKey

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase admin environment variables not set. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.')
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _supabaseAdmin
}
