<script setup lang="ts">
import { X, Gem, AlertCircle, ArrowRight } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
  requiredTokens?: number
  currentBalance?: number
}

const props = withDefaults(defineProps<Props>(), {
  requiredTokens: 0,
  currentBalance: 0,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { track } = useEventTracker()

function close() {
  emit('update:modelValue', false)
}

function handleUpgrade() {
  // 埋點：點擊升級方案
  track('click_upgrade')
  close()
  navigateTo('/pricing')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="close"
        />

        <!-- Modal -->
        <div class="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-amber-100 rounded-xl">
                <AlertCircle class="w-5 h-5 text-amber-600" />
              </div>
              <h3 class="text-lg font-semibold text-stone-800">Token 餘額不足</h3>
            </div>
            <button
              class="p-2 hover:bg-stone-100 rounded-full transition-colors"
              @click="close"
            >
              <X class="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6">
            <div class="mb-6">
              <p class="text-stone-600 mb-4">
                此操作需要 <span class="font-semibold text-stone-800">{{ requiredTokens }} Token</span>，
                您目前剩餘 <span class="font-semibold text-amber-600">{{ currentBalance }} Token</span>。
              </p>

              <div class="p-4 bg-amber-50 rounded-xl">
                <div class="flex items-center gap-2 text-amber-700">
                  <Gem class="w-5 h-5" />
                  <span class="font-medium">
                    還需 {{ requiredTokens - currentBalance }} Token
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-stone-800">創作者方案</span>
                  <span class="text-purple-600 font-bold">NT$ 899/月</span>
                </div>
                <p class="text-sm text-stone-600 mb-3">
                  每月 1,000 Token，滿足您的創作需求
                </p>
                <button
                  class="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all"
                  @click="handleUpgrade"
                >
                  升級方案
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>

              <button
                class="w-full py-3 text-stone-600 hover:text-stone-800 transition-colors"
                @click="close"
              >
                稍後再說
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
}
</style>
