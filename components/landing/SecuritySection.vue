<script setup lang="ts">
const securityFeatures = [
  {
    icon: '🏆',
    title: 'ISO 27001 認證',
    description: '符合 ISO/IEC 27001:2022 國際資安標準',
  },
  {
    icon: '🖥️',
    title: '世界級伺服器',
    description: '採用頂級雲端基礎設施，確保穩定運行',
  },
  {
    icon: '🔒',
    title: '透明隱私政策',
    description: '您的數據安全是我們的首要任務',
  },
  {
    icon: '👥',
    title: '專業資安團隊',
    description: '24/7 全天候監控，保障系統安全',
  },
]
</script>

<template>
  <section class="py-20 bg-stone-900">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
          企業級安全保障
        </h2>
        <p class="text-lg text-stone-400 max-w-2xl mx-auto">
          我們採用最高標準的安全措施，保護您的數據和隱私
        </p>
      </div>

      <!-- Security Features Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="feature in securityFeatures"
          :key="feature.title"
          class="p-6 bg-stone-800/50 rounded-2xl border border-stone-700 hover:border-purple-500/50 transition-colors"
        >
          <div class="text-4xl mb-4">{{ feature.icon }}</div>
          <h3 class="text-lg font-semibold text-white mb-2">
            {{ feature.title }}
          </h3>
          <p class="text-stone-400 text-sm">
            {{ feature.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
