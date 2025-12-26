<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()
const isLoading = ref(false)
const error = ref<string | null>(null)

async function handleCMoneySignIn() {
  isLoading.value = true
  error.value = null
  try {
    await authStore.login($manager, '/create')
  } catch (e: any) {
    error.value = e.message || '登入失敗'
    isLoading.value = false
  }
}

// Redirect if already logged in
watch(
  () => authStore.user,
  (user) => {
    if (user) {
      navigateTo('/create')
    }
  },
  { immediate: true }
)

// Initialize auth state on mount
onMounted(async () => {
  if ($manager) {
    await authStore.setUserFromManager($manager)
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <!-- Logo -->
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold gradient-text">DreaMake</h1>
          <p class="text-stone-500 mt-2">AI 影片生成平台</p>
        </div>

        <!-- Error Message -->
        <div
          v-if="error"
          class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
        >
          {{ error }}
        </div>

        <!-- CMoney Sign In -->
        <button
          class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
          :disabled="isLoading"
          @click="handleCMoneySignIn"
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span class="font-medium">
            {{ isLoading ? '登入中...' : '使用 CMoney 帳號登入' }}
          </span>
        </button>

        <!-- Terms -->
        <p class="text-center text-xs text-stone-400 mt-6">
          登入即表示您同意我們的服務條款和隱私政策
        </p>
      </div>
    </div>
  </div>
</template>
