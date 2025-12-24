<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const supabase = useSupabaseClient()

onMounted(async () => {
  // Handle the OAuth callback
  const { error } = await supabase.auth.getSession()

  if (error) {
    console.error('Auth callback error:', error)
    navigateTo('/auth?error=' + encodeURIComponent(error.message))
    return
  }

  // Redirect to create page after successful auth
  navigateTo('/create')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p class="text-stone-500">正在登入...</p>
    </div>
  </div>
</template>
