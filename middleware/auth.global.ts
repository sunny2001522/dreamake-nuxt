export default defineNuxtRouteMiddleware(async (to) => {
  // Skip on server-side
  if (import.meta.server) return

  const { $manager } = useNuxtApp()
  const authStore = useAuthStore()

  // Skip for OIDC callback routes
  const callbackRoutes = ['/login', '/logout', '/refresh']
  if (callbackRoutes.includes(to.path)) {
    return
  }

  // Initialize auth state if not done yet
  if (!authStore.isInitialized && $manager) {
    await authStore.setUserFromManager($manager)
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/']
  if (publicRoutes.includes(to.path)) {
    return
  }

  // Protect other routes - trigger CMoney login if not logged in
  if (authStore.isGuest) {
    await authStore.login($manager, to.fullPath)
    return
  }
})
