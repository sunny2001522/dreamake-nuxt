<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  snapPoints?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  snapPoints: () => [0.5, 0.9],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const currentHeight = ref(props.snapPoints[0])
const isDragging = ref(false)
const startY = ref(0)
const startHeight = ref(0)

function close() {
  emit('update:modelValue', false)
}

function handleTouchStart(e: TouchEvent) {
  isDragging.value = true
  startY.value = e.touches[0].clientY
  startHeight.value = currentHeight.value
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging.value) return

  const deltaY = startY.value - e.touches[0].clientY
  const deltaPercent = deltaY / window.innerHeight
  let newHeight = startHeight.value + deltaPercent

  // Clamp to snap points
  newHeight = Math.max(0.2, Math.min(0.95, newHeight))
  currentHeight.value = newHeight
}

function handleTouchEnd() {
  isDragging.value = false

  // Snap to nearest point
  const nearestSnap = props.snapPoints.reduce((prev, curr) =>
    Math.abs(curr - currentHeight.value) < Math.abs(prev - currentHeight.value) ? curr : prev
  )

  // Close if dragged below minimum
  if (currentHeight.value < 0.3) {
    close()
  } else {
    currentHeight.value = nearestSnap
  }
}

// Prevent body scroll when sheet is open
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.body.style.overflow = 'hidden'
      currentHeight.value = props.snapPoints[0]
    } else {
      document.body.style.overflow = ''
    }
  }
)

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="close"
        />

        <!-- Sheet -->
        <div
          class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300"
          :style="{ height: `${currentHeight * 100}vh` }"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <!-- Handle -->
          <div class="flex justify-center pt-3 pb-2">
            <div class="w-10 h-1 bg-stone-300 rounded-full" />
          </div>

          <!-- Header -->
          <div v-if="title" class="px-4 pb-4 border-b border-stone-100">
            <h3 class="text-lg font-semibold text-stone-800">{{ title }}</h3>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto overscroll-contain">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
