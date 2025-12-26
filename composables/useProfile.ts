import { useApi } from './useApi'

interface ProfileResponse {
  nickname: string
  email: string
  image: string
}

export const useProfile = () => {
  const PROFILE_DOMAIN = import.meta.env.VITE_PROFILE_SERVICE_DOMAIN

  const getProfile = async (): Promise<ProfileResponse | null> => {
    const api = useApi()

    const { data, error } = await api.post<ProfileResponse>(
      `${PROFILE_DOMAIN}/graphql/query/member`,
      {
        fields: '{ nickname email image }',
      }
    )

    if (error) {
      console.error('Failed to get profile:', error)
      return null
    }

    return data
  }

  return { getProfile }
}
