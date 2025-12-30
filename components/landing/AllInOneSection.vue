<script setup lang="ts">
import { ArrowDown, Video, Scissors } from "lucide-vue-next";
</script>

<template>
  <section class="py-20 bg-stone-50">
    <div class="container mx-auto px-4 text-center">
      <h2 class="text-3xl md:text-4xl font-bold text-stone-800 mb-12">
        告別繁瑣工具
      </h2>

      <!-- 被劃掉的工具列表 -->
      <div class="space-y-8 mb-10 max-w-2xl mx-auto">
        <!-- 文稿生成 AI -->
        <div class="flex flex-col items-center gap-3">
          <span
            class="text-lg md:text-xl text-stone-400 line-through decoration-2 decoration-red-400"
          >
            丟掉文稿生成 AI
          </span>
          <div class="flex gap-4">
            <!-- ChatGPT -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="ChatGPT"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-7 h-7"
                fill="none"
                stroke="#10a37f"
                stroke-width="1.5"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                  fill="none"
                />
                <path
                  d="M8 12h8M12 8v8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle cx="12" cy="12" r="3" fill="#10a37f" />
              </svg>
            </div>
            <!-- Gemini -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="Gemini"
            >
              <svg viewBox="0 0 24 24" class="w-7 h-7">
                <path
                  d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                  fill="url(#gemini-gradient)"
                />
                <defs>
                  <linearGradient
                    id="gemini-gradient"
                    x1="2"
                    y1="2"
                    x2="22"
                    y2="22"
                  >
                    <stop offset="0%" stop-color="#4285f4" />
                    <stop offset="33%" stop-color="#ea4335" />
                    <stop offset="66%" stop-color="#fbbc05" />
                    <stop offset="100%" stop-color="#34a853" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        <!-- 製作影片工具 -->
        <div class="flex flex-col items-center gap-3">
          <span
            class="text-lg md:text-xl text-stone-400 line-through decoration-2 decoration-red-400"
          >
            丟掉製作影片工具
          </span>
          <div class="flex gap-4">
            <!-- 攝影機 -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="攝影機"
            >
              <Video class="w-6 h-6 text-stone-600" />
            </div>
            <!-- Heygen -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="Heygen"
            >
              <svg viewBox="0 0 24 24" class="w-7 h-7">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                  fill="#1a56db"
                />
                <text
                  x="12"
                  y="16"
                  text-anchor="middle"
                  fill="white"
                  font-size="10"
                  font-weight="bold"
                  font-family="Arial"
                >
                  H
                </text>
              </svg>
            </div>
            <!-- Runway -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="Runway"
            >
              <svg viewBox="0 0 24 24" class="w-7 h-7">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                  fill="#000000"
                />
                <text
                  x="12"
                  y="16"
                  text-anchor="middle"
                  fill="white"
                  font-size="10"
                  font-weight="bold"
                  font-family="Arial"
                >
                  R
                </text>
              </svg>
            </div>
          </div>
        </div>

        <!-- 影片剪輯和上字幕軟體 -->
        <div class="flex flex-col items-center gap-3">
          <span
            class="text-lg md:text-xl text-stone-400 line-through decoration-2 decoration-red-400"
          >
            丟掉影片剪輯和上字幕軟體
          </span>
          <div class="flex gap-4">
            <!-- 剪映 CapCut -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="剪映"
            >
              <Scissors class="w-6 h-6 text-stone-800" />
            </div>
            <!-- Premiere Pro -->
            <div
              class="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center opacity-60"
              title="Premiere Pro"
            >
              <svg viewBox="0 0 24 24" class="w-7 h-7">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  fill="#9999ff"
                />
                <text
                  x="12"
                  y="16"
                  text-anchor="middle"
                  fill="#1a0033"
                  font-size="8"
                  font-weight="bold"
                  font-family="Arial"
                >
                  Pr
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 箭頭 -->
      <div class="my-8">
        <ArrowDown class="w-8 h-8 mx-auto text-purple-500 animate-bounce" />
      </div>

      <!-- 強調訊息 -->
      <div class="text-2xl md:text-3xl font-bold">
        <span class="gradient-text">DreaMake</span>
        <span class="text-stone-800"> 一條龍幫你完成</span>
      </div>
    </div>
  </section>
</template>
