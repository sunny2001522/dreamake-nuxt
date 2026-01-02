<script setup lang="ts">
import { Check, Gem, Crown } from "lucide-vue-next";
import type { SubscriptionPlan } from "~/types/subscription";

interface Props {
  plan: SubscriptionPlan;
  currentPlan?: string;
  loading?: boolean;
  highlighted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currentPlan: "",
  loading: false,
  highlighted: false,
});

const emit = defineEmits<{
  subscribe: [planCode: string];
}>();

const isCurrentPlan = computed(() => props.currentPlan === props.plan.code);

function handleClick() {
  if (!isCurrentPlan.value) {
    emit("subscribe", props.plan.code);
  }
}
</script>

<template>
  <div
    :class="[
      'relative rounded-2xl transition-all duration-300',
      highlighted
        ? 'bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-[2px]'
        : 'border border-stone-200',
    ]"
  >
    <!-- 推薦標籤 -->
    <div
      v-if="highlighted"
      class="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
    >
      <span
        class="px-4 py-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium rounded-full shadow-lg"
      >
        推薦
      </span>
    </div>

    <div
      :class="['h-full p-8 rounded-2xl', highlighted ? 'bg-white' : 'bg-white']"
    >
      <!-- 方案圖示和名稱 -->
      <div class="flex items-center gap-3 mb-4">
        <h3 class="text-xl font-bold text-stone-800">{{ plan.name }}</h3>
      </div>

      <!-- 價格 -->
      <div class="mb-6">
        <div class="flex items-baseline gap-1">
          <span class="text-sm text-stone-500">NT$</span>
          <span class="text-4xl font-bold text-stone-800">
            {{ plan.price.toLocaleString() }}
          </span>
          <span class="text-stone-500">/月</span>
        </div>
      </div>

      <!-- Token 配額 -->
      <div
        :class="[
          'mb-6 p-4 rounded-xl',
          highlighted ? 'bg-purple-50' : 'bg-stone-50',
        ]"
      >
        <div class="flex items-center gap-2">
          <Gem
            :class="[
              'w-5 h-5',
              highlighted ? 'text-purple-500' : 'text-stone-500',
            ]"
          />
          <span
            :class="[
              'font-semibold',
              highlighted ? 'text-purple-700' : 'text-stone-700',
            ]"
          >
            每月 {{ plan.tokensMonthly.toLocaleString() }} Token
          </span>
        </div>
      </div>

      <!-- 功能列表 -->
      <ul class="space-y-3 mb-8">
        <li
          v-for="feature in plan.features"
          :key="feature"
          class="flex items-start gap-3"
        >
          <Check class="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
          <span class="text-stone-600">{{ feature }}</span>
        </li>
      </ul>

      <!-- CTA 按鈕 -->
      <button
        :disabled="isCurrentPlan || loading"
        :class="[
          'w-full py-3 px-6 rounded-xl font-medium transition-all',
          isCurrentPlan
            ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
            : highlighted
            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 shadow-lg shadow-purple-200'
            : 'bg-stone-800 text-white hover:bg-stone-700',
        ]"
        @click="handleClick"
      >
        <span v-if="loading" class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          處理中...
        </span>
        <span v-else-if="isCurrentPlan">目前方案</span>
        <span v-else-if="plan.code === 'free'">開始免費使用</span>
        <span v-else>立即升級</span>
      </button>
    </div>
  </div>
</template>
