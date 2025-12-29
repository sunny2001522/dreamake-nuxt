<script setup lang="ts">
import exampleVideo from "~/assets/video/example-female.mp4";

const steps = [
  {
    number: "01",
    title: "選擇模板與虛擬人像",
    description: "從豐富的模板庫中選擇適合的風格，挑選或上傳您的虛擬人物形象。",
  },
  {
    number: "02",
    title: "創建 AI 語音",
    description: "輸入文字或上傳聲音樣本，AI 將生成自然流暢的語音內容。",
  },
  {
    number: "03",
    title: "添加自訂元素",
    description: "加入字幕、背景音樂、特效等元素，打造專屬風格的影片。",
  },
  {
    number: "04",
    title: "生成 AI 影片",
    description: "一鍵生成高品質影片，快速匯出並分享到各大平台。",
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
        <!-- Step 1: 頭像選擇 -->
        <div class="relative">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100"
          >
            <!-- 展示區：模擬 ImageUploader -->
            <div class="p-4 bg-stone-50">
              <div
                class="bg-white rounded-xl p-4 shadow-sm border border-stone-100"
              >
                <div class="flex items-center justify-between mb-3">
                  <label class="font-bold text-stone-800 text-sm">照片</label>
                </div>
                <!-- 預覽圖 -->
                <div
                  class="relative aspect-square rounded-xl overflow-hidden bg-stone-800"
                >
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
                    alt="範例頭像"
                    class="w-full h-full object-cover"
                  />
                  <!-- Hover 效果 -->
                  <div
                    class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <span
                      class="px-3 py-2 bg-white/90 rounded-lg text-sm font-medium text-stone-800"
                    >
                      更換
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 步驟說明 -->
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
          </div>
        </div>

        <!-- Step 2: 語音選擇 -->
        <div class="relative">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100"
          >
            <!-- 展示區：模擬 VoicePicker 已選狀態 -->
            <div class="p-4 bg-stone-50">
              <div
                class="bg-white rounded-xl p-4 shadow-sm border border-stone-100"
              >
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm font-medium text-stone-700">聲音</label>
                  <span class="text-xs text-stone-400">選擇要模仿的人聲</span>
                </div>
                <!-- 已選語音預覽 -->
                <div
                  class="flex items-center gap-3 p-3 bg-stone-100 rounded-xl"
                >
                  <div
                    class="w-10 h-10 bg-stone-700 rounded-full flex items-center justify-center"
                  >
                    <svg
                      class="w-5 h-5 text-white"
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
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-stone-800 truncate">
                      我的語音
                    </p>
                    <p class="text-xs text-stone-500">已選擇</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 步驟說明 -->
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
          </div>
        </div>

        <!-- Step 3: 字幕設定 -->
        <div class="relative">
          <!-- Connector Line -->
          <div
            class="hidden lg:block absolute top-1/3 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0"
          />

          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100"
          >
            <!-- 展示區：模擬 SubtitleSettings -->
            <div class="p-4 bg-stone-50">
              <div
                class="bg-white rounded-xl p-4 shadow-sm border border-stone-100"
              >
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm font-medium text-stone-700"
                    >字幕設定</label
                  >
                  <!-- Toggle 開關 (模擬開啟狀態) -->
                  <div class="relative w-12 h-6 bg-stone-600 rounded-full">
                    <span
                      class="absolute left-0 top-1 w-4 h-4 bg-white rounded-full translate-x-7"
                    />
                  </div>
                </div>

                <!-- 下拉選單 -->
                <div class="flex gap-2">
                  <!-- Font Dropdown -->
                  <div class="flex-1">
                    <button
                      class="w-full flex items-center justify-between bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 px-3"
                    >
                      <span>黑體</span>
                      <svg
                        class="w-4 h-4 text-stone-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <!-- Background Dropdown -->
                  <div class="flex-1">
                    <button
                      class="w-full flex items-center justify-between bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 px-3"
                    >
                      <span>無背景</span>
                      <svg
                        class="w-4 h-4 text-stone-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 步驟說明 -->
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
          </div>
        </div>

        <!-- Step 4: 生成影片 -->
        <div class="relative">
          <div
            class="relative z-10 bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-100"
          >
            <!-- 展示區：影片預覽 -->
            <div class="p-4 bg-stone-50">
              <div
                class="relative aspect-[9/16] max-h-[280px] mx-auto bg-stone-900 rounded-xl overflow-hidden shadow-lg"
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

                <!-- 播放控制 UI overlay -->
                
               
              </div>
            </div>

            <!-- 步驟說明 -->
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
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
