<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await authStore.refreshCallback($manager)
    await authStore.setUserFromManager($manager)
  } catch (err) {
    console.error('Silent refresh failed:', err)
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
      <p class="text-stone-500">更新中...</p>
    </div>
  </div>
</template>
