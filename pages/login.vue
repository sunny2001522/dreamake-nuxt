<script setup lang="ts">
import { loginRedirectPath } from '~/constants/localStorage'

definePageMeta({
  layout: 'auth',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    // 嘗試處理 OIDC 回調
    await authStore.loginCallback($manager)
  } catch (err) {
    // 回調失敗時，可能是 stale state 或頁面重新整理
    // 繼續檢查用戶是否已經有有效的 token
    console.warn('Login callback error (may be stale state):', err)
  }

  try {
    // 無論回調是否成功，都嘗試從 manager 獲取用戶狀態
    await authStore.setUserFromManager($manager)

    // 檢查用戶是否已登入
    if (!authStore.isGuest) {
      // 用戶已登入，導向目標頁面
      const redirectPath = JSON.parse(
        localStorage.getItem(loginRedirectPath) || '"/create"'
      )
      localStorage.removeItem(loginRedirectPath)
      await navigateTo(redirectPath)
    } else {
      // 用戶未登入，導向首頁並顯示錯誤
      await navigateTo('/?error=login_failed')
    }
  } catch (err) {
    console.error('Failed to get user state:', err)
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
