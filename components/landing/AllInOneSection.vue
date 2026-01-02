<script setup lang="ts">
import { ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";

const sectionRef = ref<HTMLElement | null>(null);
const isConverged = ref(false);

useIntersectionObserver(
  sectionRef,
  ([{ isIntersecting }]) => {
    isConverged.value = isIntersecting;
  },
  { threshold: 0.4 }
);
</script>

<template>
  <section ref="sectionRef" class="relative min-h-[120vh] bg-stone-50 overflow-hidden">
    <div class="container mx-auto px-4 py-20">
      <!-- Section Header -->
      <h2
        class="text-3xl md:text-4xl font-bold text-stone-800 mb-12 text-center"
      >
        告別繁瑣工具
      </h2>

      <!-- Sticky Container -->
      <div class="sticky top-24">
        <!-- Cards Container -->
        <div class="relative">
          <!-- Three Cards Grid -->
          <div class="cards-wrapper" :class="{ converged: isConverged }">
            <!-- Left Card: 文稿生成 AI -->
            <div class="card card-left">
              <div
                class="bg-white rounded-2xl p-6 shadow-lg border border-stone-100 h-full"
              >
                <h3 class="text-lg font-bold text-stone-800 mb-2 text-center">
                  文稿生成 AI
                </h3>
                <p
                  class="text-sm text-stone-400 line-through decoration-red-400 text-center mb-4"
                >
                  丟掉這些工具
                </p>
                <div class="flex justify-center gap-4">
                  <!-- ChatGPT -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="ChatGPT"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10" fill="#10a37f">
                      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.6 8.3829l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                    </svg>
                  </div>
                  <!-- Gemini -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="Gemini"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10">
                      <defs>
                        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#4285f4"/>
                          <stop offset="50%" stop-color="#9b72cb"/>
                          <stop offset="100%" stop-color="#d96570"/>
                        </linearGradient>
                      </defs>
                      <path fill="url(#gemini-grad)" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 3.6c2.3 0 4.4 1 5.9 2.5l-2.8 2.8c-.9-.9-2.2-1.4-3.5-1.4-2.8 0-4.9 2.3-4.9 5s2.2 5 4.9 5c2.4 0 4.2-1.4 4.6-3.4H12v-2.9h7.7c.1.6.2 1.3.2 1.9 0 5-3.4 8.6-8.2 8.6-4.8 0-8.7-3.9-8.7-8.7s3.9-8.4 8.7-8.4z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Center Card: 影片製作工具 -->
            <div class="card card-center">
              <div
                class="bg-white rounded-2xl p-6 shadow-lg border border-stone-100 h-full"
              >
                <h3 class="text-lg font-bold text-stone-800 mb-2 text-center">
                  影片製作工具
                </h3>
                <p
                  class="text-sm text-stone-400 line-through decoration-red-400 text-center mb-4"
                >
                  丟掉這些工具
                </p>
                <div class="flex justify-center gap-4">
                  <!-- HeyGen -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="HeyGen"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10">
                      <rect x="2" y="2" width="20" height="20" rx="4" fill="#1a56db"/>
                      <path fill="white" d="M7 7h2.5v4h5V7H17v10h-2.5v-4h-5v4H7V7z"/>
                    </svg>
                  </div>
                  <!-- Runway -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="Runway"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10">
                      <rect x="2" y="2" width="20" height="20" rx="4" fill="#000000"/>
                      <path fill="white" d="M7 7h5c2.2 0 4 1.8 4 4 0 1.5-.8 2.8-2 3.5l2.5 2.5h-3l-2-2H9.5v2H7V7zm2.5 5.5h2.5c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5H9.5v3z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Card: 剪輯字幕軟體 -->
            <div class="card card-right">
              <div
                class="bg-white rounded-2xl p-6 shadow-lg border border-stone-100 h-full"
              >
                <h3 class="text-lg font-bold text-stone-800 mb-2 text-center">
                  剪輯字幕軟體
                </h3>
                <p
                  class="text-sm text-stone-400 line-through decoration-red-400 text-center mb-4"
                >
                  丟掉這些工具
                </p>
                <div class="flex justify-center gap-4">
                  <!-- CapCut -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="CapCut"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10">
                      <rect x="2" y="2" width="20" height="20" rx="4" fill="#000000"/>
                      <path fill="none" stroke="url(#capcut-grad)" stroke-width="2" stroke-linecap="round" d="M8 7v10M8 12h5l3-5M16 12v5"/>
                      <defs>
                        <linearGradient id="capcut-grad" x1="8" y1="7" x2="16" y2="17">
                          <stop offset="0%" stop-color="#00f2ea"/>
                          <stop offset="100%" stop-color="#ff0050"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <!-- Premiere Pro -->
                  <div
                    class="w-14 h-14 rounded-xl bg-stone-50 shadow-sm flex items-center justify-center"
                    title="Premiere Pro"
                  >
                    <svg viewBox="0 0 24 24" class="w-10 h-10">
                      <rect x="2" y="2" width="20" height="20" rx="2" fill="#9999ff"/>
                      <path fill="#300050" d="M7 6v12h2.5v-4H12c2.2 0 4-1.8 4-4s-1.8-4-4-4H7zm2.5 2.5H12c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5H9.5V8.5z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- DreaMake Overlay Card -->
          <div
            class="dreamake-overlay"
            :class="{ visible: isConverged }"
          >
            <div
              class="bg-white rounded-3xl px-12 py-10 shadow-2xl border border-purple-100"
            >
              <div class="text-center">
                <div
                  class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-2xl shadow-lg mb-6"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div class="text-3xl md:text-4xl font-bold">
                  <span class="gradient-text">DreaMake</span>
                </div>
                <p class="text-xl text-stone-600 mt-2">一條龍幫你完成</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile fallback -->
      <div
        class="md:hidden text-center mt-8 transition-all duration-500"
        :class="isConverged ? 'opacity-100' : 'opacity-0'"
      >
        <div class="text-2xl font-bold">
          <span class="gradient-text">DreaMake</span>
          <span class="text-stone-800"> 一條龍幫你完成</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gradient-text {
  background: linear-gradient(135deg, #ff6b9d 0%, #c86dd7 50%, #9747ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Cards Grid */
.cards-wrapper {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  position: relative;
  z-index: 1;
}

@media (max-width: 768px) {
  .cards-wrapper {
    grid-template-columns: 1fr;
  }
}

/* Card base styles */
.card {
  transition: all 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: 0.8s;
}

/* Converged state - cards move toward center and down */
.converged .card-left {
  transform: translateX(80%) translateY(60px) scale(0.85);
  opacity: 0.6;
}

.converged .card-center {
  transform: translateY(60px) scale(0.85);
  opacity: 0.6;
}

.converged .card-right {
  transform: translateX(-80%) translateY(60px) scale(0.85);
  opacity: 0.6;
}

@media (max-width: 768px) {
  .converged .card-left,
  .converged .card-center,
  .converged .card-right {
    transform: translateY(30px) scale(0.9);
    opacity: 0.5;
  }
}

/* DreaMake Overlay */
.dreamake-overlay {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) translateY(-80px);
  z-index: 10;
  opacity: 0;
  transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: 1.2s;
  pointer-events: none;
}

.dreamake-overlay.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
</style>
