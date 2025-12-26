<script setup lang="ts">
interface Props {
  active?: boolean
  barCount?: number
  color?: 'red' | 'purple' | 'stone'
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  active: false,
  barCount: 5,
  color: 'red',
  size: 'sm',
})
</script>

<template>
  <div
    class="flex items-center justify-center"
    :class="{
      'gap-0.5 h-4': size === 'sm',
      'gap-1 h-6': size === 'md',
      'gap-1 h-8': size === 'lg',
    }"
  >
    <span
      v-for="i in barCount"
      :key="i"
      class="rounded-full transition-all"
      :class="[
        color === 'red' ? 'bg-red-500' : color === 'purple' ? 'bg-purple-500' : 'bg-stone-400',
        size === 'sm' ? 'w-0.5' : size === 'md' ? 'w-1' : 'w-1.5',
        active ? 'animate-soundwave' : 'h-1 opacity-50',
      ]"
      :style="active ? { animationDelay: `${(i - 1) * 0.12}s` } : {}"
    />
  </div>
</template>

<style scoped>
@keyframes soundwave {
  0%,
  100% {
    height: 20%;
    opacity: 0.5;
  }
  50% {
    height: 100%;
    opacity: 1;
  }
}

.animate-soundwave {
  animation: soundwave 0.8s ease-in-out infinite;
}
</style>
