import type { UserManager, User } from 'oidc-client-ts'
import { loginRedirectPath, logoutRedirectPath } from '~/constants/localStorage'
import { useProfile } from '~/composables/useProfile'

interface TokenInfo {
  access_token: string
  expires_at: string
  refresh_token: string
}

interface AuthInfo {
  is_guest: boolean
  sub: string
  nickname: string
  email: string
  avatar: string
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const tokenInfo = ref<TokenInfo>({
    access_token: '',
    expires_at: '',
    refresh_token: '',
  })

  const authInfo = ref<AuthInfo>({
    is_guest: true,
    sub: '',
    nickname: '',
    email: '',
    avatar: '',
  })

  const isLoading = ref(true)
  const isInitialized = ref(false)

  // Getters
  const isGuest = computed(() => authInfo.value.is_guest)
  const user = computed(() => (authInfo.value.is_guest ? null : authInfo.value))

  const hasValidToken = computed(() => {
    const { access_token, expires_at } = tokenInfo.value
    if (!access_token) return false

    const expiryTime = parseInt(expires_at, 10) * 1000
    const now = Date.now()
    return now < expiryTime - 30000
  })

  // Private helpers
  function isValidUser(user: User | null): user is User {
    return !!user && !user.expired && !!user.access_token
  }

  function setTokenInfo(data: Partial<TokenInfo>) {
    tokenInfo.value = {
      access_token: data.access_token || '',
      expires_at: String(data.expires_at || ''),
      refresh_token: data.refresh_token || '',
    }
  }

  function setAuthInfo(data: Partial<AuthInfo>) {
    authInfo.value = {
      is_guest: data.is_guest ?? true,
      sub: data.sub || '',
      nickname: data.nickname || '',
      email: data.email || '',
      avatar: data.avatar || '',
    }
  }

  function clearTokenInfo() {
    tokenInfo.value = {
      access_token: '',
      expires_at: '',
      refresh_token: '',
    }
  }

  function clearAuthInfo() {
    authInfo.value = {
      is_guest: true,
      sub: '',
      nickname: '',
      email: '',
      avatar: '',
    }
  }

  function clearAllState() {
    clearTokenInfo()
    clearAuthInfo()
    isInitialized.value = false
  }

  // Actions
  async function setUserFromManager(manager: UserManager) {
    isLoading.value = true
    try {
      const oidcUser = await manager.getUser()

      if (isValidUser(oidcUser)) {
        await setAuthenticatedState(oidcUser)
      } else {
        setGuestState()
      }

      isInitialized.value = true
    } catch (error) {
      console.error('Failed to get user from OIDC manager:', error)
      setGuestState()
      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function setAuthenticatedState(oidcUser: User) {
    setTokenInfo({
      access_token: oidcUser.access_token,
      expires_at: String(oidcUser.expires_at),
      refresh_token: oidcUser.refresh_token,
    })

    const { getProfile } = useProfile()
    const profileData = await getProfile()

    setAuthInfo({
      is_guest: false,
      sub: oidcUser.profile?.sub || '',
      nickname: profileData?.nickname || oidcUser.profile?.nickname || '',
      email: profileData?.email || oidcUser.profile?.email || '',
      avatar: profileData?.image || '',
    })
  }

  function setGuestState() {
    clearTokenInfo()
    setAuthInfo({
      is_guest: true,
      sub: '',
      nickname: '',
      email: '',
      avatar: '',
    })
  }

  async function login(manager: UserManager, redirectPath: string = '/') {
    if (!redirectPath) {
      throw new Error('Redirect path is required')
    }

    try {
      localStorage.setItem(loginRedirectPath, JSON.stringify(redirectPath))

      await manager.signinRedirect({
        prompt: 'select_account',
      })
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  async function loginCallback(manager: UserManager) {
    try {
      await manager.signinRedirectCallback()
      await manager.clearStaleState()
    } catch (error) {
      console.error('Login callback failed:', error)
      throw error
    }
  }

  async function logout(manager: UserManager, redirectPath: string = '/') {
    try {
      localStorage.setItem(logoutRedirectPath, JSON.stringify(redirectPath))

      clearTokenInfo()
      await manager.signoutRedirect()
    } catch (error) {
      console.error('Logout failed:', error)
      throw error
    }
  }

  async function logoutCallback(manager: UserManager) {
    try {
      await manager.signoutRedirectCallback()

      const redirectPath = JSON.parse(
        localStorage.getItem(logoutRedirectPath) || '"/"'
      )
      localStorage.removeItem(logoutRedirectPath)

      clearAllState()
      await manager.clearStaleState()

      await navigateTo(redirectPath)
    } catch (error) {
      console.error('Logout callback failed:', error)
      throw error
    }
  }

  async function refreshCallback(manager: UserManager) {
    try {
      await manager.signinSilentCallback()
    } catch (error) {
      console.error('Silent refresh failed:', error)
      throw error
    }
  }

  function removeUser(manager: UserManager) {
    try {
      manager.removeUser()
      clearAllState()
    } catch (error) {
      console.error('Failed to remove user:', error)
      clearAllState()
    }
  }

  return {
    // State
    tokenInfo,
    authInfo,
    isLoading,
    isInitialized,

    // Getters
    isGuest,
    user,
    hasValidToken,

    // Actions
    setUserFromManager,
    login,
    loginCallback,
    logout,
    logoutCallback,
    refreshCallback,
    removeUser,
  }
})
