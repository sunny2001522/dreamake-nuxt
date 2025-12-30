<script setup lang="ts">
import exampleVideo from "~/assets/video/example-female.mp4";

const steps = [
  {
    number: "01",
    title: "分析個人風格",
    description: "AI 分析您的風格與內容特色，打造專屬短影音策略。",
  },
  {
    number: "02",
    title: "選擇你的照片和聲音",
    description: "上傳照片或選擇虛擬人物，搭配克隆語音或精選配音。",
  },
  {
    number: "03",
    title: "一鍵生成短影音逐字稿",
    description: "AI 自動生成符合您風格的爆款腳本內容。",
  },
  {
    number: "04",
    title: "生成爆紅短影音 有字幕",
    description: "一鍵生成完整影片，自動添加精美字幕。",
  },
];
</script>

<template>
  <section class="py-20 bg-gradient-to-b from-white to-stone-50">
    <div class="container mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-stone-800 mb-4">
          四步驟輕鬆製作 AI 影片
        </h2>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          簡單直覺的操作流程，讓每個人都能快速上手
        </p>
      </div>

      <!-- Steps Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <!-- Step 1: 分析個人風格 -->
        <div class="relative h-full">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100 h-full flex flex-col"
          >
            <!-- 步驟說明 (上方) -->
            <div class="p-4 text-center">
              <div
                class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white text-sm font-bold rounded-full mb-3"
              >
                {{ steps[0].number }}
              </div>
              <h3 class="text-lg font-bold text-stone-800 mb-2">
                {{ steps[0].title }}
              </h3>
              <p class="text-stone-600 text-sm leading-relaxed">
                {{ steps[0].description }}
              </p>
            </div>

            <!-- 展示區：風格分析標籤 -->
            <div class="p-4 bg-stone-50 flex-1 flex items-center justify-center">
              <div
                class="bg-white rounded-xl p-4 shadow-sm border border-stone-100 w-full"
              >
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span class="text-sm font-medium text-stone-700"
                    >分析完成</span
                  >
                </div>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                    >知識型內容</span
                  >
                  <span
                    class="px-3 py-1 bg-pink-100 text-pink-700 text-xs rounded-full"
                    >輕鬆幽默</span
                  >
                  <span
                    class="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                    >科技主題</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: 選擇照片和聲音 -->
        <div class="relative h-full">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100 h-full flex flex-col"
          >
            <!-- 步驟說明 (上方) -->
            <div class="p-4 text-center">
              <div
                class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white text-sm font-bold rounded-full mb-3"
              >
                {{ steps[1].number }}
              </div>
              <h3 class="text-lg font-bold text-stone-800 mb-2">
                {{ steps[1].title }}
              </h3>
              <p class="text-stone-600 text-sm leading-relaxed">
                {{ steps[1].description }}
              </p>
            </div>

            <!-- 展示區：頭像與語音選擇 -->
            <div class="p-4 bg-stone-50 flex-1 flex items-center justify-center">
              <div class="w-full space-y-3">
                <!-- 頭像 -->
                <div
                  class="bg-white rounded-xl p-3 shadow-sm border border-stone-100 flex items-center gap-3"
                >
                  <div
                    class="w-12 h-12 rounded-full overflow-hidden bg-stone-200"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
                      alt="範例頭像"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-stone-800">我的照片</p>
                    <p class="text-xs text-green-600">已選擇</p>
                  </div>
                </div>
                <!-- 語音 -->
                <div
                  class="bg-white rounded-xl p-3 shadow-sm border border-stone-100 flex items-center gap-3"
                >
                  <div
                    class="w-12 h-12 bg-stone-700 rounded-full flex items-center justify-center"
                  >
                    <svg
                      class="w-6 h-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-stone-800">我的語音</p>
                    <p class="text-xs text-green-600">已選擇</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: 一鍵生成逐字稿 -->
        <div class="relative h-full">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100 h-full flex flex-col"
          >
            <!-- 步驟說明 (上方) -->
            <div class="p-4 text-center">
              <div
                class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white text-sm font-bold rounded-full mb-3"
              >
                {{ steps[2].number }}
              </div>
              <h3 class="text-lg font-bold text-stone-800 mb-2">
                {{ steps[2].title }}
              </h3>
              <p class="text-stone-600 text-sm leading-relaxed">
                {{ steps[2].description }}
              </p>
            </div>

            <!-- 展示區：腳本預覽 -->
            <div class="p-4 bg-stone-50 flex-1 flex items-center justify-center">
              <div
                class="bg-white rounded-xl p-4 shadow-sm border border-stone-100 w-full"
              >
                <div class="flex items-center gap-2 mb-3">
                  <svg
                    class="w-4 h-4 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span class="text-sm font-medium text-stone-700">AI 腳本</span>
                </div>
                <div class="space-y-2 text-xs text-stone-600">
                  <p>今天來聊聊這個超實用的技巧...</p>
                  <p class="text-stone-400">很多人不知道的是...</p>
                  <p class="text-stone-300">學會之後效率提升 300%...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: 生成爆紅短影音 -->
        <div class="relative h-full">
          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100 h-full flex flex-col"
          >
            <!-- 步驟說明 (上方) -->
            <div class="p-4 text-center">
              <div
                class="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white text-sm font-bold rounded-full mb-3"
              >
                {{ steps[3].number }}
              </div>
              <h3 class="text-lg font-bold text-stone-800 mb-2">
                {{ steps[3].title }}
              </h3>
              <p class="text-stone-600 text-sm leading-relaxed">
                {{ steps[3].description }}
              </p>
            </div>

            <!-- 展示區：影片預覽 -->
            <div class="p-4 bg-stone-50 flex-1 flex items-center justify-center">
              <div
                class="relative aspect-[9/16] max-h-[200px] mx-auto bg-stone-900 rounded-xl overflow-hidden shadow-lg"
              >
                <video
                  autoplay
                  loop
                  muted
                  playsinline
                  class="w-full h-full object-cover"
                >
                  <source :src="exampleVideo" type="video/mp4" />
                </video>
               
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
