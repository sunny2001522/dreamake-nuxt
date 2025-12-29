<script setup lang="ts">
const features = [
  {
    icon: '🎤',
    title: '聲音克隆',
    description: '打造完美複製個人聲音的 AI 分身，保留您獨特的說話風格。支援多種語言與情感表達。',
    cta: '立即克隆您的聲音',
    highlight: '140+ 種語言',
  },
  {
    icon: '🖼️',
    title: 'AI 虛擬人物',
    description: '上傳照片即刻生成逼真 AI 頭像，讓您的分身開口說話，自然流暢。',
    cta: '立即創建虛擬人物',
    highlight: '1500+ 虛擬人物',
  },
  {
    icon: '📝',
    title: 'AI 腳本生成',
    description: '輸入主題，AI 根據您的風格自動生成專業影片腳本，節省創作時間。',
    cta: '立即生成腳本',
    highlight: '智能創作',
  },
  {
    icon: '🎬',
    title: '自動字幕',
    description: '自動生成精確同步的多語言字幕，多種樣式可選，提升影片專業度。',
    cta: '立即添加字幕',
    highlight: '精準同步',
  },
]

const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-stone-800 mb-4">
          強大的 AI 功能
        </h2>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          運用先進的 AI 技術，快速製作符合各種主題的專業影片內容
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="group p-8 bg-gradient-to-br from-stone-50 to-white rounded-2xl border border-stone-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300"
        >
          <div class="flex items-start gap-4">
            <div class="text-5xl">{{ feature.icon }}</div>
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-xl font-bold text-stone-800">
                  {{ feature.title }}
                </h3>
                <span class="px-2 py-1 bg-purple-100 text-purple-600 text-xs font-medium rounded-full">
                  {{ feature.highlight }}
                </span>
              </div>
              <p class="text-stone-600 mb-4 leading-relaxed">
                {{ feature.description }}
              </p>
              <button
                class="text-purple-600 font-medium hover:text-purple-700 transition-colors flex items-center gap-1 group-hover:gap-2"
                @click="emit('start')"
              >
                {{ feature.cta }}
                <span class="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
