<script setup lang="ts">
import { Mic, Image, FileText, Clapperboard, type LucideIcon } from 'lucide-vue-next'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  cta: string
  highlight: string
}

const features: Feature[] = [
  {
    icon: Mic,
    title: '聲音克隆',
    description: '上傳 30 秒錄音，AI 即可複製你的聲線、語調、說話節奏。生成結果達 95% 相似度，連家人都分不出來。',
    cta: '立即克隆您的聲音',
    highlight: '30 秒完成',
  },
  {
    icon: Image,
    title: 'AI 虛擬人物',
    description: '一張照片，3 分鐘生成會眨眼、有表情的虛擬分身。支援真人照片或選擇 50+ 風格化角色。',
    cta: '立即創建虛擬人物',
    highlight: '3 分鐘生成',
  },
  {
    icon: FileText,
    title: 'AI 風格學習腳本',
    description: '輸入主題，AI 用你的口吻寫稿。學習你的用詞習慣、句式結構、觀點邏輯，產出 100% 你風格的腳本。',
    cta: '立即生成腳本',
    highlight: '節省 80% 時間',
  },
  {
    icon: Clapperboard,
    title: '自動字幕',
    description: '98% 準確率的即時字幕生成，支援 140+ 語言互譯。20+ 字幕樣式，一鍵套用品牌風格。',
    cta: '立即添加字幕',
    highlight: '140+ 語言',
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
          一個分身，四大超能力
        </h2>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          從聲音到思維，AI 完整複製你的創作 DNA
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="group p-8 bg-gradient-to-br from-stone-50 to-white rounded-2xl border border-stone-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300"
        >
          <div class="flex items-start gap-4">
            <component :is="feature.icon" class="w-12 h-12 text-purple-500 flex-shrink-0" />
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
              
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
