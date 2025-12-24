<script setup lang="ts">
const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="py-20 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
    <div class="container mx-auto px-4 text-center">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">
        準備好開始創作了嗎？
      </h2>
      <p class="text-white/80 text-lg mb-8 max-w-xl mx-auto">
        立即免費試用，體驗 AI 影片生成的魔力。
      </p>
      <button
        class="px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl hover:shadow-lg transition-all"
        @click="emit('start')"
      >
        免費開始
      </button>
    </div>
  </section>
</template>
