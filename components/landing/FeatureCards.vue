<script setup lang="ts">
const features = [
  {
    icon: '🎤',
    title: '語音克隆',
    description: '上傳您的聲音樣本，AI 將學習並複製您獨特的說話風格。',
  },
  {
    icon: '🖼️',
    title: '頭像動畫',
    description: '上傳一張照片，AI 會讓它開口說話，自然且逼真。',
  },
  {
    icon: '📝',
    title: 'AI 腳本生成',
    description: '輸入主題，AI 會根據您的風格生成專業的影片腳本。',
  },
  {
    icon: '🎬',
    title: '自動字幕',
    description: '自動生成精確同步的字幕，多種樣式可選。',
  },
]
</script>

<template>
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl font-bold text-center text-stone-800 mb-12">
        強大的功能
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="p-6 bg-stone-50 rounded-2xl hover:shadow-lg transition-shadow"
        >
          <div class="text-4xl mb-4">{{ feature.icon }}</div>
          <h3 class="text-lg font-semibold text-stone-800 mb-2">
            {{ feature.title }}
          </h3>
          <p class="text-stone-600">
            {{ feature.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
