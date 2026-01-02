<script setup lang="ts">
import {
  Heart,
  Newspaper,
  TrendingUp,
  GraduationCap,
  Mic,
  type LucideIcon,
} from 'lucide-vue-next'

import exampleFemale from '~/assets/video/example-female.mp4'
import exampleMale from '~/assets/video/exmaple-male.mp4'
import exampleAnime from '~/assets/video/example-anime.mp4'

interface UseCase {
  icon: LucideIcon
  title: string
  description: string
  video: string
}

const useCases: UseCase[] = [
  { icon: Heart, title: '個人價值觀輸出', description: '分享你的人生觀、理念與想法', video: exampleFemale },
  { icon: Newspaper, title: '時事分享', description: '快速產出時事評論與觀點影片', video: exampleMale },
  { icon: TrendingUp, title: '股市解盤', description: '專業財經分析、投資觀點分享', video: exampleAnime },
  { icon: GraduationCap, title: '教學解說', description: '知識傳授、技能教學影片', video: exampleFemale },
  { icon: Mic, title: '採訪', description: '人物專訪、對談節目製作', video: exampleMale },
]
</script>

<template>
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-stone-800 mb-4">
          創作者應用場景
        </h2>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          無論你是 KOL、講師還是內容創作者，DreaMake 都能幫你快速產出專業影片
        </p>
      </div>

      <!-- 5 Cards Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div
          v-for="useCase in useCases"
          :key="useCase.title"
          class="bg-stone-50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
        >
          <!-- Video -->
          <div class="aspect-[9/16] bg-stone-900">
            <video
              :src="useCase.video"
              class="w-full h-full object-cover"
              autoplay
              loop
              muted
              playsinline
            />
          </div>
          <!-- Content -->
          <div class="p-4 text-center">
            <div class="flex items-center justify-center gap-2 mb-2">
              <component :is="useCase.icon" class="w-5 h-5 text-purple-500" />
              <h3 class="font-semibold text-stone-800">{{ useCase.title }}</h3>
            </div>
            <p class="text-sm text-stone-500">{{ useCase.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
