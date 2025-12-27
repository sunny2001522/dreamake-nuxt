<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await authStore.logoutCallback($manager)
  } catch (err) {
    console.error('Logout failed:', err)
    await authStore.logout($manager, '/auth')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
      <p class="text-stone-500">登出中...</p>
    </div>
  </div>
</template>
