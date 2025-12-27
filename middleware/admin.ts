/**
 * Admin route middleware
 * Verifies user has admin access before allowing route navigation
 */
export default defineNuxtRouteMiddleware(async () => {
  // Skip on server-side
  if (import.meta.server) return

  const { $manager } = useNuxtApp()
  const authStore = useAuthStore()

  // Ensure auth is initialized
  if (!authStore.isInitialized && $manager) {
    await authStore.setUserFromManager($manager as any)
  }

  // Guest users cannot access admin
  if (authStore.isGuest) {
    return navigateTo('/')
  }

  // Verify admin access via API
  try {
    await $fetch('/api/admin/usage', {
      method: 'GET',
      headers: {
        'x-user-email': authStore.authInfo.email || '',
      },
    })
  } catch (error: any) {
    // If 403 or 401, user is not admin
    if (error.statusCode === 403 || error.statusCode === 401) {
      console.warn('[Admin Middleware] Access denied for:', authStore.authInfo.email)
      return navigateTo('/')
    }
    // For other errors, still allow access (might be temporary API issue)
    console.error('[Admin Middleware] Error verifying admin access:', error)
  }
})
