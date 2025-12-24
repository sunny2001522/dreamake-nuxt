import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(true)

  // Initialize auth state
  async function initialize() {
    isLoading.value = true
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null
    } catch (error) {
      console.error('Failed to initialize auth:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession
    user.value = newSession?.user ?? null
  })

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    user.value = null
    session.value = null
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (error) throw error
  }

  return {
    user,
    session,
    isLoading,
    initialize,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
  }
})
