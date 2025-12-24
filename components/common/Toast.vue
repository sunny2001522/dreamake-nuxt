<script setup lang="ts">
const toastStore = useToastStore()

const iconMap = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const colorMap = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          class="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg border border-stone-100 min-w-[280px] max-w-[400px]"
        >
          <span
            :class="[
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
              colorMap[toast.type],
            ]"
          >
            {{ iconMap[toast.type] }}
          </span>
          <p class="flex-1 text-sm text-stone-700">
            {{ toast.message }}
          </p>
          <button
            class="flex-shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
            @click="toastStore.removeToast(toast.id)"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
