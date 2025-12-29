<script setup lang="ts">
import { loginRedirectPath } from '~/constants/localStorage'

definePageMeta({
  layout: 'auth',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await authStore.loginCallback($manager)

    const redirectPath = JSON.parse(
      localStorage.getItem(loginRedirectPath) || '"/create"'
    )
    localStorage.removeItem(loginRedirectPath)

    await authStore.setUserFromManager($manager)

    navigateTo(redirectPath)
  } catch (err) {
    console.error('Login callback failed:', err)
    // Redirect to auth page with error instead of retrying login (avoid infinite loop)
    await navigateTo('/?error=login_failed')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
      <p class="text-stone-500">登入中...</p>
    </div>
  </div>
</template>
