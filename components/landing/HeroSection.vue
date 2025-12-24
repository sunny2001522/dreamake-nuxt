<script setup lang="ts">
const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
    <!-- Background Gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50" />

    <!-- Content -->
    <div class="relative z-10 container mx-auto px-4 text-center">
      <h1 class="text-4xl md:text-6xl font-bold mb-6">
        <span class="gradient-text">AI 驅動的</span>
        <br />
        <span class="text-stone-800">影片生成平台</span>
      </h1>

      <p class="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8">
        輸入文字，選擇頭像和聲音，一鍵生成專業的說話人影片。
        適合 KOL、教育工作者、內容創作者。
      </p>

      <CommonButton size="lg" @click="emit('start')">
        開始創作
      </CommonButton>
    </div>
  </section>
</template>
