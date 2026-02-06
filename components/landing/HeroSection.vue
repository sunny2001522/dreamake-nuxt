<script setup lang="ts">
import { Clapperboard, Mic, Image, FileText } from "lucide-vue-next";
import exampleFemale from "~/assets/video/example-female.mp4";
import exampleAnime from "~/assets/video/example-anime.mp4";
import exampleMale from "~/assets/video/example-male.mp4";

const emit = defineEmits<{
  start: [];
}>();

const videos = [exampleFemale, exampleAnime, exampleMale];
</script>

<template>
  <section
    class="relative min-h-[80vh] flex items-center justify-center overflow-hidden"
  >
    <!-- Background Gradient -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50"
    />

    <!-- Decorative Elements -->
    <div
      class="absolute top-20 left-10 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl"
    />
    <div
      class="absolute bottom-20 right-10 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl"
    />

    <!-- Content -->
    <div
      class="relative z-10 container mx-auto py-10 px-4 md:flex gap-6 justify-around items-center"
    >
      <div class="text-center">
       

        <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span class="gradient-text">DreaMake</span>
          <br />
          <span class="text-stone-800">打造你的 AI 第二分身</span>
        </h1>

        <p class="text-lg md:text-xl text-stone-600 max-w-3xl mx-auto mb-8">
          AI 學習你的說話方式、用詞習慣、思維邏輯
          <br class="hidden md:block" />
          讓分身代替你，持續產出 100% 你風格的影片內容
        </p>

        <!-- Features Tags -->
        <div
          class="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 mb-10 text-stone-500 text-sm"
        >
          <span class="inline-flex items-center gap-1">
            <Mic class="w-4 h-4" />
            聲音複製 95% 相似度
          </span>
          <span class="text-stone-300">·</span>
          <span class="inline-flex items-center gap-1">
            <Image class="w-4 h-4" />
            3 分鐘生成虛擬分身
          </span>
          <span class="text-stone-300">·</span>
          <span class="inline-flex items-center gap-1">
            <FileText class="w-4 h-4" />
            學習你風格的 AI 編劇
          </span>
          <span class="text-stone-300">·</span>
          <span class="inline-flex items-center gap-1">
            <Clapperboard class="w-4 h-4" />
            140+ 語言字幕
          </span>
        </div>

        <CommonButton size="lg" @click="emit('start')">
          免費創建我的 AI 分身
        </CommonButton>
      </div>

      <!-- Video Carousel -->
      <div class="md:w-1/4 overflow-hidden mt-12">
        <div class="flex animate-scroll">
          <div
            v-for="(video, i) in [...videos, ...videos]"
            :key="i"
            class="shrink-0 px-2"
          >
            <video
              autoplay
              loop
              muted
              playsinline
              class="rounded-2xl h-64 w-auto"
            >
              <source :src="video" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.animate-scroll {
  animation: scroll 20s linear infinite;
}
</style>
