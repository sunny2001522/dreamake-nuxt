<script setup lang="ts">
const { $manager } = useNuxtApp()
const authStore = useAuthStore()
const route = useRoute()

const isMenuOpen = ref(false)

const navLinks = [
  { name: '創作', path: '/create', requiresAuth: true },
  { name: '歷史', path: '/history', requiresAuth: true },
]

async function handleSignOut() {
  await authStore.logout($manager, '/')
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-100">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
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
            <!-- User Avatar -->
            <div class="relative">
              <button
                class="flex items-center gap-2 p-1 rounded-full hover:bg-stone-100 transition-colors"
                @click="isMenuOpen = !isMenuOpen"
              >
                <img
                  :src="authStore.authInfo.avatar || '/default-avatar.png'"
                  :alt="authStore.authInfo.nickname || 'User'"
                  class="w-8 h-8 rounded-full object-cover"
                />
              </button>

              <!-- Dropdown Menu -->
              <Transition name="dropdown">
                <div
                  v-if="isMenuOpen"
                  class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-stone-100 py-2"
                >
                  <div class="px-4 py-2 border-b border-stone-100">
                    <p class="text-sm font-medium text-stone-800 truncate">
                      {{ authStore.authInfo.nickname || authStore.authInfo.email }}
                    </p>
                    <p class="text-xs text-stone-500 truncate">
                      {{ authStore.authInfo.email }}
                    </p>
                  </div>

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
            <NuxtLink
              to="/auth"
              class="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              登入
            </NuxtLink>
            <CommonButton size="sm" @click="navigateTo('/auth')">
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
