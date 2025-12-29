<script setup lang="ts">
import {
  BarChart3,
  GraduationCap,
  BookOpen,
  Newspaper,
  Briefcase,
  Megaphone,
  MessageSquare,
  Video,
  type LucideIcon,
} from 'lucide-vue-next'

interface UseCase {
  icon: LucideIcon
  title: string
  description: string
}

const useCases: UseCase[] = [
  { icon: BarChart3, title: '解說視頻', description: '產品介紹、功能說明' },
  { icon: GraduationCap, title: '培訓與發展', description: '員工培訓、技能提升' },
  { icon: BookOpen, title: '教學影片', description: '線上課程、知識分享' },
  { icon: Newspaper, title: '新聞播報', description: '資訊傳遞、新聞報導' },
  { icon: Briefcase, title: '銷售影片', description: '產品推廣、銷售轉換' },
  { icon: Megaphone, title: '市場行銷', description: '品牌宣傳、活動推廣' },
  { icon: MessageSquare, title: '溝通影片', description: '內部溝通、公告通知' },
  { icon: Video, title: '教程影片', description: '操作指南、使用教學' },
]
</script>

<template>
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-stone-800 mb-4">
          多元應用場景
        </h2>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          無論您是企業、教育機構還是個人創作者，DreaMake 都能滿足您的需求
        </p>
      </div>

      <!-- Use Cases Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div
          v-for="useCase in useCases"
          :key="useCase.title"
          class="group p-6 bg-stone-50 rounded-2xl hover:bg-gradient-to-br hover:from-pink-50 hover:to-purple-50 hover:shadow-lg transition-all duration-300 cursor-pointer"
        >
          <div class="mb-4 group-hover:scale-110 transition-transform">
            <component :is="useCase.icon" class="w-10 h-10 text-purple-500" />
          </div>
          <h3 class="text-lg font-semibold text-stone-800 mb-2">
            {{ useCase.title }}
          </h3>
          <p class="text-sm text-stone-500">
            {{ useCase.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
