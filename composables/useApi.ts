import { useAuthStore } from '~/stores/auth'

export const useApi = () => {
  const authStore = useAuthStore()

  const request = async <T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      headers?: Record<string, string>
    } = {}
  ): Promise<{ data: T | null; error: Error | null }> => {
    const { method = 'GET', body, headers = {} } = options

    try {
      const response = await $fetch<T>(path, {
        method,
        body,
        headers: {
          ...headers,
          Authorization: authStore.tokenInfo.access_token
            ? `Bearer ${authStore.tokenInfo.access_token}`
            : '',
        },
      })

      return { data: response, error: null }
    } catch (err) {
      console.error('API request failed:', err)
      return { data: null, error: err as Error }
    }
  }

  const get = <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers })

  const post = <T>(path: string, body?: any, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body, headers })

  const put = <T>(path: string, body?: any, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body, headers })

  const patch = <T>(path: string, body?: any, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body, headers })

  const del = <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', headers })

  return { request, get, post, put, patch, delete: del }
}
