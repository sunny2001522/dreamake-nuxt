<script setup lang="ts">
const currentYear = new Date().getFullYear()

const productLinks = [
  { label: 'AI 影片生成', href: '#' },
  { label: '語音克隆', href: '#' },
  { label: 'AI 虛擬人物', href: '#' },
  { label: 'AI 腳本生成', href: '#' },
]

const resourceLinks = [
  { label: '使用教學', href: '#' },
  { label: '常見問題', href: '#' },
  { label: '部落格', href: '#' },
]

const companyLinks = [
  { label: '關於我們', href: '#' },
  { label: '聯絡我們', href: '#' },
  { label: '隱私政策', href: '#' },
  { label: '服務條款', href: '#' },
]
</script>

<template>
  <footer class="py-16 bg-stone-900 text-stone-400">
    <div class="container mx-auto px-4">
      <!-- Main Footer Content -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
        <!-- Brand -->
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span class="text-2xl font-bold text-white">DreaMake</span>
          </div>
          <p class="text-sm text-stone-500 mb-6">
            AI 驅動的影片生成平台，讓每個人都能輕鬆創作專業影片。
          </p>
          <!-- Social Links -->
          <div class="flex items-center gap-4">
            <a href="#" class="text-stone-500 hover:text-white transition-colors">
              <span class="text-xl">𝕏</span>
            </a>
            <a href="#" class="text-stone-500 hover:text-white transition-colors">
              <span class="text-xl">📘</span>
            </a>
            <a href="#" class="text-stone-500 hover:text-white transition-colors">
              <span class="text-xl">📸</span>
            </a>
          </div>
        </div>

        <!-- Product Links -->
        <div>
          <h3 class="text-white font-semibold mb-4">產品功能</h3>
          <ul class="space-y-3">
            <li v-for="link in productLinks" :key="link.label">
              <a
                :href="link.href"
                class="text-sm hover:text-white transition-colors"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Resource Links -->
        <div>
          <h3 class="text-white font-semibold mb-4">資源</h3>
          <ul class="space-y-3">
            <li v-for="link in resourceLinks" :key="link.label">
              <a
                :href="link.href"
                class="text-sm hover:text-white transition-colors"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Company Links -->
        <div>
          <h3 class="text-white font-semibold mb-4">公司</h3>
          <ul class="space-y-3">
            <li v-for="link in companyLinks" :key="link.label">
              <a
                :href="link.href"
                class="text-sm hover:text-white transition-colors"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="pt-8 border-t border-stone-800">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-sm text-stone-500">
            © {{ currentYear }} DreaMake. All rights reserved.
          </p>
          <div class="flex items-center gap-6 text-sm text-stone-500">
            <a href="#" class="hover:text-white transition-colors">隱私政策</a>
            <a href="#" class="hover:text-white transition-colors">服務條款</a>
            <a href="#" class="hover:text-white transition-colors">Cookie 設定</a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
