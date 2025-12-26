import { useAuthStore } from '~/stores/auth'

interface ProfileResponse {
  nickname: string
  email: string
  image: string
}

export const useProfile = () => {
  const getProfile = async (): Promise<ProfileResponse | null> => {
    const authStore = useAuthStore()
    const accessToken = authStore.tokenInfo.access_token

    if (!accessToken) {
      console.error('No access token available')
      return null
    }

    try {
      // Use local API proxy to avoid CORS issues
      const response = await $fetch<ProfileResponse>('/api/profile/member', {
        method: 'POST',
        body: { accessToken },
      })

      return response
    } catch (error) {
      console.error('Failed to get profile:', error)
      return null
    }
  }

  return { getProfile }
}
