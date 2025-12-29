<script setup lang="ts">
import { Clapperboard, Mic, Image, FileText } from "lucide-vue-next";
import exampleFemale from "~/assets/video/example-female.mp4";
import exampleAnime from "~/assets/video/example-anime.mp4";
import exampleMale from "~/assets/video/exmaple-male.mp4";

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
        <!-- Badge -->
        <div
          class="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm mb-8"
        >
          <Clapperboard class="w-4 h-4 text-purple-600" />
          <span class="text-sm font-medium text-purple-600"
            >免費 AI 影片生成器</span
          >
        </div>

        <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span class="gradient-text">DreaMake</span>
          <br />
          <span class="text-stone-800">AI 影片生成平台</span>
        </h1>

        <p class="text-lg md:text-xl text-stone-600 max-w-3xl mx-auto mb-8">
          輕鬆製作高品質 AI 影片，10 倍速生成專業說話人影片。
          <br class="hidden md:block" />
          適合 KOL、教育工作者、企業培訓、內容創作者。
        </p>

        <!-- Features Tags -->
        <div class="flex flex-wrap justify-center gap-3 mb-10">
          <span
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur rounded-full text-sm text-stone-600"
          >
            <Mic class="w-4 h-4" />
            語音克隆
          </span>
          <span
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur rounded-full text-sm text-stone-600"
          >
            <Image class="w-4 h-4" />
            AI 虛擬人物
          </span>
          <span
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur rounded-full text-sm text-stone-600"
          >
            <FileText class="w-4 h-4" />
            AI 腳本生成
          </span>
          <span
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur rounded-full text-sm text-stone-600"
          >
            <Clapperboard class="w-4 h-4" />
            自動字幕
          </span>
        </div>

        <CommonButton size="lg" @click="emit('start')">
          立即免費製作影片
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
