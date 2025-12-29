<script setup lang="ts">
const stats = [
  {
    value: '$10,000',
    unit: '/月',
    label: '節省影片製作成本',
    icon: '💰',
  },
  {
    value: '+52%',
    unit: '',
    label: '提升互動率',
    icon: '📈',
  },
  {
    value: '74%',
    unit: '',
    label: '提高轉換率',
    icon: '🎯',
  },
  {
    value: '+200%',
    unit: '',
    label: '加速市場成長',
    icon: '🚀',
  },
]
</script>

<template>
  <section class="py-20 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
          實際成效
        </h2>
        <p class="text-lg text-white/80 max-w-2xl mx-auto">
          使用 DreaMake 的企業和創作者都獲得了顯著的成效提升
        </p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="text-center p-6 bg-white/10 backdrop-blur rounded-2xl"
        >
          <div class="text-4xl mb-4">{{ stat.icon }}</div>
          <div class="flex items-baseline justify-center gap-1 mb-2">
            <span class="text-4xl md:text-5xl font-bold text-white">
              {{ stat.value }}
            </span>
            <span class="text-xl text-white/80">{{ stat.unit }}</span>
          </div>
          <p class="text-white/80 text-sm">
            {{ stat.label }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
