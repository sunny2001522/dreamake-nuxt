<script setup lang="ts">
import { User, Gem } from 'lucide-vue-next'
import { onClickOutside } from '@vueuse/core'

const { $manager } = useNuxtApp()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const route = useRoute()

const { tokenBalance, isLowBalance, isCriticalBalance, planName, isInitialized } = storeToRefs(subscriptionStore)

// 當用戶登入時載入訂閱資訊
watch(
  () => authStore.user,
  async (user) => {
    if (user && authStore.authInfo.sub) {
      await subscriptionStore.loadSubscription(authStore.authInfo.sub)
    } else {
      subscriptionStore.reset()
    }
  },
  { immediate: true }
)

const isMenuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

onClickOutside(menuRef, () => {
  isMenuOpen.value = false
})

const navLinks = [
  { name: '創作', path: '/create', requiresAuth: true },
  { name: '歷史', path: '/history', requiresAuth: true },
]

async function handleSignOut() {
  await authStore.logout($manager, '/')
}

async function handleLogin() {
  await authStore.login($manager, '/create')
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-100">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink :to="authStore.user ? '/create' : '/'" class="flex items-center gap-2">
          <span class="text-xl font-bold gradient-text">DreaMake</span>
        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-6">
          <template v-for="link in navLinks" :key="link.path">
            <NuxtLink
              v-if="!link.requiresAuth || authStore.user"
              :to="link.path"
              :class="[
                'text-sm font-medium transition-colors',
                route.path === link.path
                  ? 'text-purple-600'
                  : 'text-stone-600 hover:text-stone-900',
              ]"
            >
              {{ link.name }}
            </NuxtLink>
          </template>
        </nav>

        <!-- Auth Section -->
        <div class="flex items-center gap-4">
          <template v-if="authStore.user">
            <!-- Token Balance -->
            <NuxtLink
              v-if="isInitialized"
              to="/account"
              :class="[
                'hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                isCriticalBalance
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : isLowBalance
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
              ]"
            >
              <Gem class="w-4 h-4" />
              <span>{{ tokenBalance }}</span>
            </NuxtLink>

            <!-- User Avatar -->
            <div ref="menuRef" class="relative">
              <button
                class="flex items-center gap-2 p-2 rounded-full hover:bg-stone-100 transition-colors"
                @click="isMenuOpen = !isMenuOpen"
              >
                <User class="w-6 h-6 text-stone-600" />
              </button>

              <!-- Dropdown Menu -->
              <Transition name="dropdown">
                <div
                  v-if="isMenuOpen"
                  class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-stone-100 py-2"
                >
                  <div class="px-4 py-2 border-b border-stone-100">
                    <p class="text-sm font-medium text-stone-800 truncate">
                      {{ authStore.authInfo.nickname || '使用者' }}
                    </p>
                    <p v-if="authStore.authInfo.email" class="text-xs text-stone-500 truncate">
                      {{ authStore.authInfo.email }}
                    </p>
                    <!-- 方案和 Token 顯示 -->
                    <div v-if="isInitialized" class="flex items-center gap-2 mt-2">
                      <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        {{ planName }}
                      </span>
                      <span class="flex items-center gap-1 text-xs text-stone-500">
                        <Gem class="w-3 h-3" />
                        {{ tokenBalance }}
                      </span>
                    </div>
                  </div>

                  <NuxtLink
                    to="/account"
                    class="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    @click="isMenuOpen = false"
                  >
                    帳戶設定
                  </NuxtLink>

                  <NuxtLink
                    to="/pricing"
                    class="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    @click="isMenuOpen = false"
                  >
                    升級方案
                  </NuxtLink>

                  <NuxtLink
                    to="/history"
                    class="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    @click="isMenuOpen = false"
                  >
                    歷史記錄
                  </NuxtLink>

                  <button
                    class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    @click="handleSignOut"
                  >
                    登出
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <template v-else>
            <button
              class="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
              @click="handleLogin"
            >
              登入
            </button>
            <CommonButton size="sm" @click="handleLogin">
              開始使用
            </CommonButton>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
