<script setup lang="ts">
import type { QuotaStatus } from '~/types/admin'

interface Props {
  /** Progress value from 0 to 100 */
  value: number
  /** Status determines the color scheme */
  status: QuotaStatus
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show percentage label */
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showLabel: false,
})

// Clamp value between 0 and 100
const clampedValue = computed(() => Math.min(Math.max(props.value, 0), 100))

// Status-based color classes
const colorClass = computed(() => {
  const statusColors: Record<string, string> = {
    normal: 'bg-gradient-to-r from-purple-500 via-pink-500 to-pink-400',
    warning: 'bg-gradient-to-r from-amber-400 to-amber-500',
    critical: 'bg-gradient-to-r from-red-400 to-red-500',
    loading: 'bg-stone-300 animate-pulse',
    error: 'bg-stone-400',
  }
  return statusColors[props.status] || statusColors.normal
})

// Size classes
const sizeClass = computed(() => {
  const sizeClasses: Record<string, string> = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }
  return sizeClasses[props.size]
})

// Label color class
const labelColorClass = computed(() => {
  switch (props.status) {
    case 'critical':
      return 'text-red-500'
    case 'warning':
      return 'text-amber-500'
    case 'error':
      return 'text-stone-400'
    default:
      return 'text-stone-500'
  }
})
</script>

<template>
  <div class="relative">
    <!-- Background track -->
    <div
      class="w-full bg-stone-200 rounded-full overflow-hidden"
      :class="sizeClass"
    >
      <!-- Progress fill -->
      <div
        class="h-full transition-all duration-500 ease-out rounded-full"
        :class="[colorClass, status === 'critical' ? 'animate-pulse' : '']"
        :style="{ width: `${clampedValue}%` }"
      />
    </div>

    <!-- Optional percentage label -->
    <span
      v-if="showLabel"
      class="absolute right-0 -top-6 text-xs font-medium"
      :class="labelColorClass"
    >
      {{ clampedValue.toFixed(0) }}%
    </span>
  </div>
</template>
