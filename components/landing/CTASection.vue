<script setup lang="ts">
import { Rocket, Check } from 'lucide-vue-next'

const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="py-24 bg-gradient-to-br from-stone-50 to-white">
    <div class="container mx-auto px-4 text-center">
      <!-- Decorative Element -->
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-2xl shadow-lg mb-8">
        <Rocket class="w-10 h-10 text-white" />
      </div>

      <h2 class="text-3xl md:text-5xl font-bold text-stone-800 mb-6">
        你的 AI 分身，正在等你
      </h2>
      <p class="text-stone-600 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
        每天有 500+ 創作者用 DreaMake 分身持續產出內容。
        <br class="hidden md:block" />
        你的分身，什麼時候上線？
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          class="px-10 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-300"
          @click="emit('start')"
        >
          免費創建我的 AI 分身
        </button>
      </div>

      <!-- Trust Indicators -->
      <div class="flex flex-wrap items-center justify-center gap-8 mt-12 text-stone-500">
        <div class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-500" />
          <span class="text-sm">免費開始</span>
        </div>
        <div class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-500" />
          <span class="text-sm">無需信用卡</span>
        </div>
        <div class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-500" />
          <span class="text-sm">隨時取消</span>
        </div>
      </div>
    </div>
  </section>
</template>
