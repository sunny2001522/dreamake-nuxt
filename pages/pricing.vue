<script setup lang="ts">
import { ChevronDown, Gem, Shield, Clock, Sparkles } from 'lucide-vue-next'
import type { SubscriptionPlan } from '~/types/subscription'

definePageMeta({
  layout: 'default',
})

const { $manager } = useNuxtApp()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const toastStore = useToastStore()

const { planCode } = storeToRefs(subscriptionStore)

// 獲取方案列表
const { data: plansData } = await useFetch<{ plans: SubscriptionPlan[] }>('/api/subscription/plans')

const plans = computed(() => plansData.value?.plans || [])

const isLoading = ref(false)
const openFaqIndex = ref<number | null>(null)

// FAQ 資料
const faqs = [
  {
    question: 'Token 是什麼？如何計算？',
    answer: 'Token 是 DreaMake 的使用額度單位。不同操作消耗不同的 Token：影片生成約 20-50 Token（依時長），語音合成約 3-10 Token，語音克隆 15 Token。',
  },
  {
    question: '免費方案有什麼限制？',
    answer: '免費方案每月有 100 Token 額度，可以完成約 2-3 部短影片。輸出為 720p 畫質。',
  },
  {
    question: '如何升級或取消訂閱？',
    answer: '您可以隨時在帳號設定中升級方案。取消後，您的方案將在當前計費週期結束時終止，期間仍可使用。',
  },
  {
    question: 'Token 會過期嗎？',
    answer: 'Token 在每月計費週期結束時重置，未使用的額度不會累積至下個月。建議合理規劃使用。',
  },
  {
    question: '付款方式有哪些？',
    answer: '目前支援信用卡付款。我們使用安全的第三方支付系統處理交易。',
  },
]

function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index
}

async function handleSubscribe(code: string) {
  // 如果未登入，導向登入
  if (!authStore.user) {
    await authStore.login($manager, '/pricing')
    return
  }

  // 如果是免費方案，直接開始使用
  if (code === 'free') {
    navigateTo('/create')
    return
  }

  // 創作者方案 - 顯示即將推出
  isLoading.value = true

  // TODO: 整合 Fanbar 金流
  setTimeout(() => {
    isLoading.value = false
    toastStore.info('付款功能即將推出，敬請期待！')
  }, 1000)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
    <!-- Hero Section -->
    <section class="pt-20 pb-12 px-4">
      <div class="container mx-auto text-center">
        <h1 class="text-4xl md:text-5xl font-bold text-stone-800 mb-4">
          選擇適合您的方案
        </h1>
        <p class="text-lg text-stone-600 max-w-2xl mx-auto">
          開始免費創作，隨時升級解鎖更多功能
        </p>
      </div>
    </section>

    <!-- Plans Section -->
    <section class="pb-20 px-4">
      <div class="container mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <PricingPlanCard
            v-for="plan in plans"
            :key="plan.id"
            :plan="plan"
            :current-plan="planCode"
            :loading="isLoading"
            :highlighted="plan.code === 'creator'"
            @subscribe="handleSubscribe"
          />
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-16 px-4 bg-white">
      <div class="container mx-auto">
        <h2 class="text-2xl font-bold text-stone-800 text-center mb-12">
          為什麼選擇 DreaMake？
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div class="text-center">
            <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Sparkles class="w-6 h-6 text-purple-600" />
            </div>
            <h3 class="font-semibold text-stone-800 mb-2">AI 驅動</h3>
            <p class="text-sm text-stone-600">最先進的 AI 技術，生成專業品質影片</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Gem class="w-6 h-6 text-pink-600" />
            </div>
            <h3 class="font-semibold text-stone-800 mb-2">快速生成</h3>
            <p class="text-sm text-stone-600">幾分鐘內完成影片創作</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield class="w-6 h-6 text-blue-600" />
            </div>
            <h3 class="font-semibold text-stone-800 mb-2">安全可靠</h3>
            <p class="text-sm text-stone-600">資料加密，保護您的創作</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Clock class="w-6 h-6 text-green-600" />
            </div>
            <h3 class="font-semibold text-stone-800 mb-2">隨時取消</h3>
            <p class="text-sm text-stone-600">無綁約，隨時可取消訂閱</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="py-16 px-4">
      <div class="container mx-auto max-w-3xl">
        <h2 class="text-2xl font-bold text-stone-800 text-center mb-8">
          常見問題
        </h2>
        <div class="space-y-4">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="bg-white rounded-xl border border-stone-200 overflow-hidden"
          >
            <button
              class="w-full px-6 py-4 flex items-center justify-between text-left"
              @click="toggleFaq(index)"
            >
              <span class="font-medium text-stone-800">{{ faq.question }}</span>
              <ChevronDown
                :class="[
                  'w-5 h-5 text-stone-400 transition-transform',
                  openFaqIndex === index && 'rotate-180',
                ]"
              />
            </button>
            <Transition name="collapse">
              <div v-if="openFaqIndex === index" class="px-6 pb-4">
                <p class="text-stone-600">{{ faq.answer }}</p>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 px-4 bg-gradient-to-r from-purple-600 to-pink-600">
      <div class="container mx-auto text-center">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-4">
          準備好開始創作了嗎？
        </h2>
        <p class="text-purple-100 mb-8 max-w-xl mx-auto">
          立即註冊，獲得免費 Token 開始您的 AI 影片創作之旅
        </p>
        <NuxtLink
          to="/create"
          class="inline-block px-8 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition-colors"
        >
          免費開始使用
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <LandingFooter />
  </div>
</template>

<style scoped>
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
